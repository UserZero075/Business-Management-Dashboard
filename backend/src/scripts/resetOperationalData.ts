import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

type DeleteOperation = {
  model: string;
  run: () => Prisma.PrismaPromise<Prisma.BatchPayload>;
};

const deleteOperations: DeleteOperation[] = [
  { model: 'ChatMessage', run: () => prisma.chatMessage.deleteMany() },
  { model: 'ChatParticipant', run: () => prisma.chatParticipant.deleteMany() },
  { model: 'ChatChannel', run: () => prisma.chatChannel.deleteMany() },
  { model: 'EmailOtp', run: () => prisma.emailOtp.deleteMany() },
  { model: 'ActivityLog', run: () => prisma.activityLog.deleteMany() },
  { model: 'ProjectMetric', run: () => prisma.projectMetric.deleteMany() },
  { model: 'Bug', run: () => prisma.bug.deleteMany() },
  { model: 'Task', run: () => prisma.task.deleteMany() },
  { model: 'FinancialTransaction', run: () => prisma.financialTransaction.deleteMany() },
  { model: 'ProjectMember', run: () => prisma.projectMember.deleteMany() },
  { model: 'ProjectVpsLink', run: () => prisma.projectVpsLink.deleteMany() },
  { model: 'ProjectInfraLink', run: () => prisma.projectInfraLink.deleteMany() },
  { model: 'Proposal', run: () => prisma.proposal.deleteMany() },
  { model: 'Lead', run: () => prisma.lead.deleteMany() },
  { model: 'Project', run: () => prisma.project.deleteMany() },
  { model: 'VpsServer', run: () => prisma.vpsServer.deleteMany() },
  { model: 'InfrastructureItem', run: () => prisma.infrastructureItem.deleteMany() },
  { model: 'Provider', run: () => prisma.provider.deleteMany() },
  { model: 'ExchangeRate', run: () => prisma.exchangeRate.deleteMany() },
  { model: 'Currency', run: () => prisma.currency.deleteMany() },
  { model: 'Client', run: () => prisma.client.deleteMany() },
  { model: 'Contract', run: () => prisma.contract.deleteMany() },
];

function isMissingTableError(error: unknown) {
  const code = (error as { code?: string })?.code;
  const message = error instanceof Error ? error.message : '';
  return code === 'P2021' || message.includes('no such table');
}

async function main() {
  console.log('Starting operational data reset. Preserving models: User, Role, Settings.');

  for (const operation of deleteOperations) {
    try {
      const result = await operation.run();
      console.log(`${operation.model}: ${result.count}`);
    } catch (error) {
      if (isMissingTableError(error)) {
        console.log(`${operation.model}: skipped (table does not exist yet)`);
        continue;
      }

      throw error;
    }
  }

  console.log('Operational data reset complete.');
}

main()
  .catch((error) => {
    console.error('Failed to reset operational data.');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
