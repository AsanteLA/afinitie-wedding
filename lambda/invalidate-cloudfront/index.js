/* ============================================================
   AFINITIE WEDDING — CLOUDFRONT CACHE INVALIDATION LAMBDA

   Triggered by CodePipeline after every S3 deploy.
   Invalidates all CloudFront cached files so guests always
   see the latest version of the site.
   ============================================================ */

const {
  CloudFrontClient,
  CreateInvalidationCommand,
} = require('@aws-sdk/client-cloudfront');

const {
  CodePipelineClient,
  PutJobSuccessResultCommand,
  PutJobFailureResultCommand,
} = require('@aws-sdk/client-codepipeline');

const cf         = new CloudFrontClient({ region: 'us-east-1' }); // CloudFront is always us-east-1
const pipeline   = new CodePipelineClient({ region: process.env.AWS_REGION });

const DISTRIBUTION_ID = process.env.DISTRIBUTION_ID; // e.g. E1XXXXXXXXXX

exports.handler = async (event) => {
  const jobId = event['CodePipeline.job'].id;

  try {
    await cf.send(new CreateInvalidationCommand({
      DistributionId: DISTRIBUTION_ID,
      InvalidationBatch: {
        CallerReference: String(Date.now()),
        Paths: {
          Quantity: 1,
          Items: ['/*'],
        },
      },
    }));

    console.log(`Invalidation created for distribution ${DISTRIBUTION_ID}`);

    // Tell CodePipeline the action succeeded
    await pipeline.send(new PutJobSuccessResultCommand({ jobId }));

  } catch (err) {
    console.error('Invalidation failed:', err);

    await pipeline.send(new PutJobFailureResultCommand({
      jobId,
      failureDetails: {
        message: err.message,
        type: 'JobFailed',
      },
    }));
  }
};
