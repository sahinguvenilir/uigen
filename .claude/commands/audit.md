Run a full dependency audit and fix cycle:

1. Run `npm audit` to identify vulnerable packages and show the results
2. Run `npm audit fix` to apply safe updates
3. Run `npm run test` to verify nothing broke after the updates

Report what was fixed and flag anything that couldn't be auto-fixed.
