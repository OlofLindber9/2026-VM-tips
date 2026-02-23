import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function GroupsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user!.id;

  const memberships = await prisma.groupMembership.findMany({
    where: { userId },
    include: {
      group: {
        include: {
          _count: { select: { members: true, predictions: true } },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">My Groups</h1>
        <div className="flex gap-3">
          <Link href="/groups/join" className="btn-secondary text-sm">Join group</Link>
          <Link href="/groups/create" className="btn-primary text-sm">Create group</Link>
        </div>
      </div>

      {memberships.length === 0 ? (
        <div className="glass-card text-center py-12">
          <div className="text-4xl mb-3">👥</div>
          <p className="text-white/70 mb-2 font-medium">No groups yet</p>
          <p className="text-white/40 text-sm mb-6">
            Create a group and invite your friends, or join one with an invite code.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/groups/create" className="btn-primary">Create group</Link>
            <Link href="/groups/join" className="btn-secondary">Join group</Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {memberships.map((m) => {
            const isOwner = m.group.createdBy === userId;
            return (
              <Link
                key={m.groupId}
                href={`/groups/${m.groupId}`}
                className="glass-card hover:border-white/30 hover:shadow-xl transition-all"
              >
                <div className="flex justify-between items-start mb-2">
                  <h2 className="font-bold text-white text-lg">{m.group.name}</h2>
                  {isOwner && (
                    <span className="badge badge-blue">Owner</span>
                  )}
                </div>
                <p className="text-white/50 text-sm">
                  {m.group._count.members} member{m.group._count.members !== 1 ? "s" : ""} ·{" "}
                  {m.group._count.predictions} prediction{m.group._count.predictions !== 1 ? "s" : ""}
                </p>
                <p className="text-xs text-white/40 mt-2">
                  Invite code: <span className="font-mono font-bold text-white/70">{m.group.inviteCode}</span>
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
