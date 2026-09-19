/**
 * The OIDC subject the deploy role trusts (spec §14).
 *
 * GitHub puts the repository's identity into the `sub` claim of the token it hands a workflow.
 * The trust policy has to match that string exactly, and the string is not the one the AWS
 * documentation shows.
 */

/** A repository as GitHub identifies it in an OIDC token. */
export interface Repository {
  /** The owner's login, e.g. `"cabcookie"`. */
  owner: string;
  /** The owner's numeric id, from `gh api users/<owner> --jq .id`. */
  ownerId: number;
  /** The repository's name, e.g. `"presentation-software"`. */
  name: string;
  /** The repository's numeric id, from `gh api repos/<owner>/<name> --jq .id`. */
  id: number;
}

/**
 * Builds the `sub` claim of the token a deploy job presents.
 *
 * **The numbers are not decoration.** A repository with `use_immutable_subject` enabled — the
 * default for new repositories, and the setting this project runs under — appends the owner id
 * and the repository id to the names: `repo:<owner>@<ownerId>/<name>@<id>:...`. A trust policy
 * written from the documented form `repo:<owner>/<name>:...` matches no real token, and the STS
 * error looks exactly like a denial by an SCP; only CloudTrail tells the two apart. The form is
 * verifiable at any time, and that is the check `slidesend bootstrap` runs rather than trusting
 * this comment:
 *
 *     gh api repos/<owner>/<name>/actions/oidc/customization/sub
 *
 * **The environment form, not the branch form.** Because the deploy job declares
 * `environment: <name>`, GitHub replaces the `ref:` part with `environment:<name>` — the branch
 * is gone from the subject. Restricting the deployment to a branch is therefore not this
 * policy's job: it is the GitHub environment's deployment-branch rule, and
 * `slidesend bootstrap` checks that the environment carries one.
 */
export function deploySubject(
  repository: Repository,
  environment: string,
  immutable = true,
): string {
  const { owner, ownerId, name, id } = repository;
  // A repository that switched immutable subjects off sends the documented short form, and the
  // policy follows the repository rather than the other way round: `slidesend bootstrap` reads
  // the setting and passes it here.
  const what = immutable ? `${owner}@${ownerId}/${name}@${id}` : `${owner}/${name}`;
  return `repo:${what}:environment:${environment}`;
}
