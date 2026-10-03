# The commands of @nxsflow/slidesend-aws

Generated from the code; run the tests with UPDATE_DOCS=1 to refresh.

What `aws()` adds to `slidesend`. Every command takes `--profile <name>`; see [deploy-aws](deploy-aws.md).

| Command | What it does |
|---|---|
| `slidesend dev` | Runs the talk on the AWS Blocks dev server with local mocks and prints the desk link. |
| `slidesend bootstrap` | Checks every precondition of a first deployment and, with --deploy, creates the OIDC provider and the deploy role. Options: --profile, --region, --environment, --branch, --role, --domain. |
| `slidesend deploy` | Builds the site, deploys the talk's stack <stackId>-prod and prints the desk link with the control secret. Options: --profile, --region. |
| `slidesend open` | Prints the desk link of the deployed talk again. Options: --profile, --region. |
| `slidesend destroy` | Removes the talk's stack, its data included, and says what stays: the bootstrap stack, the CDK bootstrap, a hosted zone. Options: --profile, --region. |
| `slidesend workflow` | Writes the GitHub Actions workflow that checks the talk and deploys it via OIDC to .github/workflows/deploy.yml. Option: --force to overwrite. |
