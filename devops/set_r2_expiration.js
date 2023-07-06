require('dotenv').config();
const { S3Client, PutBucketLifecycleConfigurationCommand } = require("@aws-sdk/client-s3");

async function makeR2Bucket() {
  const client = new S3Client({
    endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.CF_ACCESS_KEY_ID,
      secretAccessKey: process.env.CF_SECRET_ACCESS_KEY,
    },
    region: "auto",
  });

  await client.send(new PutBucketLifecycleConfigurationCommand({
    Bucket: "express-v1-staging",
    LifecycleConfiguration: {
      Rules: [
        {
          ID: "EXPIRE_OLD_DATA",
          Expiration: {
            Days: 2
          },
          Status: "Enabled",
        },
        {
          ID: "ABORT_INCOMPLETE_UPLOADS",
          AbortIncompleteMultipartUpload: {
            DaysAfterInitiation: 1,
          },
          Status: "Enabled",
        },
      ],
    },
  }));
}

makeR2Bucket().catch(console.error);

