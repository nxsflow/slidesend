# The commands of @slidesend/aws

Generated from the code; run the tests with UPDATE_DOCS=1 to refresh.

What `aws()` adds to `slidesend`. `bootstrap`, `deploy`, `open` and `destroy` take `--profile <name>`; see [deploy-aws](deploy-aws.md).

| Command | What it does |
|---|---|
| `slidesend dev` | Runs the talk on the AWS Blocks dev server with local mocks and prints the desk link. Option: --port (default 3000; Vite runs on that port + 100). |
| `slidesend bootstrap` | Checks every precondition of a first deployment and, with --deploy, creates the OIDC provider, the deploy role and, for a domain, the hosted zone. Options: --profile, --region, --environment, --branch, --role, --domain. |
| `slidesend deploy` | Builds the site, deploys the talk's stack <stackId>-prod and prints the desk link with the control secret. Options: --profile, --region. |
| `slidesend open` | Prints the desk link of the deployed talk again. Options: --profile, --region. |
| `slidesend destroy` | Removes the talk's stack, its data included, and says what stays: the bootstrap stack, the CDK bootstrap, a hosted zone, the Lambda log groups. Options: --profile, --region. |
| `slidesend workflow` | Writes the GitHub Actions workflow that checks the talk and deploys it via OIDC to .github/workflows/deploy.yml. Options: --environment, --branch (as given to bootstrap), --force to overwrite. |
