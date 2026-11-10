import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const dm = await prisma.user.upsert({
    where: { email: "dm@example.com" },
    update: {},
    create: { name: "Dana the DM", email: "dm@example.com", passwordHash },
  });

  const playerOne = await prisma.user.upsert({
    where: { email: "player1@example.com" },
    update: {},
    create: { name: "Percy Player", email: "player1@example.com", passwordHash },
  });

  const playerTwo = await prisma.user.upsert({
    where: { email: "player2@example.com" },
    update: {},
    create: { name: "Rin Rogue", email: "player2@example.com", passwordHash },
  });

  const campaign = await prisma.campaign.upsert({
    where: { inviteCode: "demo-campaign" },
    update: {},
    create: {
      name: "Curse of the Crimson Throne",
      description: "A demo campaign seeded for local development.",
      ownerId: dm.id,
      inviteCode: "demo-campaign",
    },
  });

  await prisma.campaignMember.upsert({
    where: { campaignId_userId: { campaignId: campaign.id, userId: dm.id } },
    update: {},
    create: { campaignId: campaign.id, userId: dm.id, role: "DM" },
  });

  const playerOneMember = await prisma.campaignMember.upsert({
    where: { campaignId_userId: { campaignId: campaign.id, userId: playerOne.id } },
    update: {},
    create: { campaignId: campaign.id, userId: playerOne.id, role: "PLAYER" },
  });

  const playerTwoMember = await prisma.campaignMember.upsert({
    where: { campaignId_userId: { campaignId: campaign.id, userId: playerTwo.id } },
    update: {},
    create: { campaignId: campaign.id, userId: playerTwo.id, role: "PLAYER" },
  });

  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  nextWeek.setHours(19, 0, 0, 0);

  const proposal = await prisma.sessionProposal.create({
    data: {
      campaignId: campaign.id,
      proposedById: dm.id,
      title: "Session 1: Into the Dungeon",
      startsAt: nextWeek,
      durationMinutes: 180,
      status: "PROPOSED",
    },
  });

  await prisma.rsvp.create({
    data: {
      sessionProposalId: proposal.id,
      memberId: playerOneMember.id,
      status: "YES",
      respondedAt: new Date(),
    },
  });
  await prisma.rsvp.create({
    data: { sessionProposalId: proposal.id, memberId: playerTwoMember.id, status: "PENDING" },
  });

  await prisma.character.upsert({
    where: { memberId: playerOneMember.id },
    update: {},
    create: {
      campaignId: campaign.id,
      memberId: playerOneMember.id,
      name: "Thistle Ironwood",
      class: "Ranger",
      level: 4,
      race: "Half-Elf",
    },
  });

  await prisma.character.upsert({
    where: { memberId: playerTwoMember.id },
    update: {},
    create: {
      campaignId: campaign.id,
      memberId: playerTwoMember.id,
      name: "Rin Shadowstep",
      class: "Rogue",
      level: 4,
      race: "Tiefling",
    },
  });

  await prisma.campaignNote.upsert({
    where: { campaignId_type: { campaignId: campaign.id, type: "GENERAL" } },
    update: {},
    create: {
      campaignId: campaign.id,
      authorId: dm.id,
      type: "GENERAL",
      content: "## Campaign notes\n\nThe party just arrived in **Korvosa**.",
    },
  });

  console.log("Seeded demo data:");
  console.log(`  DM login:      dm@example.com / password123`);
  console.log(`  Player login:  player1@example.com / password123`);
  console.log(`  Invite link:   /invite/${campaign.inviteCode}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
