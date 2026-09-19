/**
 * The bootstrap stack (spec §14): the trust anchor a talk needs once, before anything else can
 * deploy it.
 *
 * It is deployed BY HAND, from the talk author's own credentials — a workflow cannot create the
 * role it needs in order to run. It is also kept apart from the application stack on purpose:
 *
 * - `cdk deploy --all` from CI would include it, and one bad edit to its trust condition would
 *   lock CI out of itself, with no way back in from CI.
 * - A custom domain's certificate is validated over DNS, so the hosted zone must exist and be
 *   delegated at the registrar before the application stack can even be synthesized. That wait
 *   is the one step whose duration nobody here controls, which is why the zone is created here.
 */
import { CfnOutput, Duration, Fn, Stack, type StackProps } from "aws-cdk-lib";
import {
  OpenIdConnectPrincipal,
  OpenIdConnectProvider,
  PolicyStatement,
  Role,
} from "aws-cdk-lib/aws-iam";
import { HostedZone } from "aws-cdk-lib/aws-route53";
import type { Construct } from "constructs";
import { deploySubject, type Repository } from "./subject";

/** The CDK bootstrap's default qualifier; the deploy role may assume only these roles. */
export const cdkQualifier = "hnb659fds";

/** Options of `BootstrapStack`. */
export interface BootstrapStackProps extends StackProps {
  /** The repository whose workflow deploys the talk. */
  repository: Repository;
  /** The GitHub environment the deploy job runs in; its branch rule restricts the branch. */
  environment: string;
  /** The name of the deploy role, e.g. `"gravity-deploy"`. */
  roleName: string;
  /**
   * Whether GitHub appends the numeric ids to this repository's subject. `slidesend bootstrap`
   * reads it from the repository; it defaults to on, which is GitHub's default.
   */
  immutableSubject?: boolean;
  /** A custom domain; with one, this stack also creates the hosted zone to delegate. */
  domain?: string;
  /**
   * An OIDC provider that already exists in this account, by ARN. An account can hold only one
   * provider per issuer URL, so a second talk in the same account imports the first one's.
   */
  existingProviderArn?: string;
}

/**
 * The GitHub OIDC provider, the deploy role and — for a custom domain — the hosted zone.
 *
 * The role itself can create nothing: it may only assume CDK's bootstrap roles and read the
 * bootstrap version. The power lies with those roles; this one is the key to them, so a leaked
 * token buys an attacker exactly what a deploy can do, and nothing more.
 */
export class BootstrapStack extends Stack {
  /** The deploy role's ARN, for the repository's `AWS_DEPLOY_ROLE` secret. */
  readonly roleArn: string;
  /** The hosted zone, when a custom domain was given. */
  readonly zone?: HostedZone;

  constructor(scope: Construct, id: string, props: BootstrapStackProps) {
    super(scope, id, props);

    /**
     * The provider is created here unless the account already has one. The thumbprints are
     * pinned rather than computed: without them CDK's custom resource reads the value from the
     * TLS chain at deploy time, and in a sibling project that produced a value no working
     * account carried. Both values below were measured — the first from an account whose deploys
     * work, the second GitHub's other known chain. Removing them trades a working deployment for
     * an answer to a question nobody asked.
     */
    const provider = props.existingProviderArn
      ? OpenIdConnectProvider.fromOpenIdConnectProviderArn(
          this,
          "GitHubOidc",
          props.existingProviderArn,
        )
      : new OpenIdConnectProvider(this, "GitHubOidc", {
          url: "https://token.actions.githubusercontent.com",
          clientIds: ["sts.amazonaws.com"],
          thumbprints: [
            "6938fd4d98bab03faadb97b34396831e3780aea1",
            "1c58a3a8518e8759bf075b76b750d4f2df264fcd",
          ],
        });

    const role = new Role(this, "DeployRole", {
      roleName: props.roleName,
      description: `Assumed by GitHub Actions to deploy ${props.repository.name}`,
      assumedBy: new OpenIdConnectPrincipal(provider, {
        StringEquals: {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          // The subject is matched in full, so `StringEquals` and not `StringLike`: there is
          // nothing to pattern-match, and a wildcard here would be a wider trust than intended.
          // No `repository_owner` condition beside it — with the owner already inside the
          // subject it adds nothing, and GitHub does not send it in every token shape.
          "token.actions.githubusercontent.com:sub": deploySubject(
            props.repository,
            props.environment,
            props.immutableSubject ?? true,
          ),
        },
      }),
      /**
       * Two hours, not CDK's default of one. `configure-aws-credentials` takes the credentials
       * once at the start of the job and never renews them, and STS refuses any requested
       * duration above this ceiling — so this number caps what the workflow may ask for. It
       * deliberately exceeds the job's own timeout: if both were the same, a deploy that nearly
       * exhausts its time would race expiring credentials instead of hitting the timeout, and
       * fail with something far less obvious.
       */
      maxSessionDuration: Duration.hours(2),
    });

    role.addToPolicy(
      new PolicyStatement({
        actions: ["sts:AssumeRole"],
        resources: [`arn:aws:iam::${this.account}:role/cdk-${cdkQualifier}-*-${this.account}-*`],
      }),
    );
    role.addToPolicy(
      new PolicyStatement({
        actions: ["ssm:GetParameter", "ssm:GetParameters"],
        resources: [
          `arn:aws:ssm:*:${this.account}:parameter/cdk-bootstrap/${cdkQualifier}/version`,
        ],
      }),
    );
    this.roleArn = role.roleArn;
    new CfnOutput(this, "DeployRoleArn", {
      value: role.roleArn,
      description: "Put this into the repository secret AWS_DEPLOY_ROLE",
    });

    if (props.domain) {
      // The zone for the talk's own name. Its four name servers have to be delegated at the
      // registrar (or in the parent zone) before the application stack can validate its
      // certificate, so they are an output: the bootstrap command prints them as the next step.
      this.zone = new HostedZone(this, "Zone", { zoneName: props.domain });
      new CfnOutput(this, "NameServers", {
        // A token list, resolved at deploy time: `Fn.join`, never `Array.join`.
        value: Fn.join(", ", this.zone.hostedZoneNameServers ?? []),
        description: `Delegate ${props.domain} to these name servers, then deploy`,
      });
    }
  }
}
