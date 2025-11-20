/**
 * AWS Lambda Handler for Subscription Reconciliation
 *
 * This Lambda function runs on a weekly schedule (Sundays 3am UTC) via EventBridge.
 * It ensures our database subscription data stays in sync with Stripe.
 *
 * WHY THIS EXISTS (For AI Agents):
 * ================================
 * Webhooks are the primary sync mechanism, but they can fail due to:
 * - Network issues during webhook delivery
 * - Application downtime when webhook fires
 * - Bugs in webhook handler code
 * - Manual changes in Stripe dashboard
 *
 * This reconciliation job is the BACKUP mechanism that catches any drift.
 *
 * Infrastructure:
 * - Deployed via CDK (infrastructure/lib/pixell-infrastructure-stack.ts)
 * - Runs in VPC: vpc-0dc5816f0b041abad (same as Fargate web service)
 * - Accesses RDS: database-3.cmkyt9c4u4iq.us-east-2.rds.amazonaws.com
 * - Security Group: sg-0869c371d1826a660 (allows port 3306)
 * - Schedule: EventBridge rule with cron expression
 */

import { ScheduledHandler, Context, ScheduledEvent } from 'aws-lambda';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import Stripe from 'stripe';
import { getDb } from '@pixell/db-mysql';
import { reconcileAllSubscriptions } from './reconciliation';

// Environment configuration
const REGION = process.env.AWS_REGION || 'us-east-2';
const SECRET_NAME = process.env.SECRET_NAME || 'pixell/prod';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY; // Fallback if not using Secrets Manager

/**
 * Lambda handler entry point
 */
export const handler: ScheduledHandler = async (
  event: ScheduledEvent,
  context: Context
): Promise<any> => {
  console.log('[Lambda] Subscription reconciliation started', {
    time: event.time,
    requestId: context.requestId,
    functionName: context.functionName,
  });

  try {
    // Initialize Stripe client
    const stripeKey = await getStripeSecretKey();
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      typescript: true,
    });

    // Get database connection
    const db = await getDb();
    console.log('[Lambda] Database connection established');

    // Run reconciliation
    const result = await reconcileAllSubscriptions(db, stripe);

    console.log('[Lambda] Reconciliation completed successfully', result);

    // Return success response
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Reconciliation completed',
        result,
      }),
    };
  } catch (error) {
    console.error('[Lambda] Reconciliation failed:', error);

    // Return error response (Lambda will retry automatically)
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Reconciliation failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

/**
 * Get Stripe secret key from AWS Secrets Manager or environment variable
 */
async function getStripeSecretKey(): Promise<string> {
  // Try environment variable first (for local testing)
  if (STRIPE_SECRET_KEY) {
    console.log('[Lambda] Using Stripe key from environment variable');
    return STRIPE_SECRET_KEY;
  }

  // Fetch from Secrets Manager
  try {
    console.log(`[Lambda] Fetching secrets from Secrets Manager: ${SECRET_NAME}`);
    const client = new SecretsManagerClient({ region: REGION });
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: SECRET_NAME,
      })
    );

    if (!response.SecretString) {
      throw new Error('Secret value is empty');
    }

    const secrets = JSON.parse(response.SecretString);

    if (!secrets.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY not found in secrets');
    }

    console.log('[Lambda] Successfully retrieved Stripe key from Secrets Manager');
    return secrets.STRIPE_SECRET_KEY;
  } catch (error) {
    console.error('[Lambda] Failed to retrieve secrets from Secrets Manager:', error);
    throw new Error('Could not retrieve Stripe secret key');
  }
}

/**
 * For local testing
 * Run with: ts-node src/handler.ts
 */
if (require.main === module) {
  console.log('[Local] Running reconciliation locally...');

  const mockEvent: ScheduledEvent = {
    version: '0',
    id: 'local-test',
    'detail-type': 'Scheduled Event',
    source: 'aws.events',
    account: 'local',
    time: new Date().toISOString(),
    region: 'local',
    resources: [],
    detail: {},
  };

  const mockContext: Context = {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'local-test',
    functionVersion: '1',
    invokedFunctionArn: 'local',
    memoryLimitInMB: '512',
    awsRequestId: 'local-request-id',
    logGroupName: 'local',
    logStreamName: 'local',
    getRemainingTimeInMillis: () => 300000,
    done: () => {},
    fail: () => {},
    succeed: () => {},
  };

  handler(mockEvent, mockContext, () => {})
    .then((result) => {
      console.log('[Local] Reconciliation completed:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('[Local] Reconciliation failed:', error);
      process.exit(1);
    });
}
