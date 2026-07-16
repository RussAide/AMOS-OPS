import type {
  M51BTeamsDestination,
  M51BTeamsIdentity,
} from "../../../../contracts/m51b/teams";
import { deepFreeze, requireTeamsSyntheticId } from "./support";

export class M51BTeamsRegistry {
  private readonly destinationsById = new Map<string, M51BTeamsDestination>();
  private readonly identitiesByActorId = new Map<string, M51BTeamsIdentity>();
  private readonly identitiesByTeamsUserId = new Map<string, M51BTeamsIdentity>();

  constructor(
    destinations: readonly M51BTeamsDestination[],
    identities: readonly M51BTeamsIdentity[],
  ) {
    for (const destination of destinations) {
      requireTeamsSyntheticId(destination.destinationId, "destination");
      requireTeamsSyntheticId(destination.teamId, "team");
      requireTeamsSyntheticId(destination.channelId, "channel");
      if (this.destinationsById.has(destination.destinationId)) {
        throw new Error("M51B_TEAMS_DESTINATION_DUPLICATE");
      }
      this.destinationsById.set(destination.destinationId, deepFreeze({
        ...destination,
        allowedEventTypes: [...destination.allowedEventTypes],
        allowedDivisions: [...destination.allowedDivisions],
        allowedSenderRoles: [...destination.allowedSenderRoles],
        allowedRecipientRoles: [...destination.allowedRecipientRoles],
        memberTeamsUserIds: [...destination.memberTeamsUserIds],
      }));
    }
    for (const identity of identities) {
      requireTeamsSyntheticId(identity.actorId, "identity_actor");
      requireTeamsSyntheticId(identity.teamsUserId, "identity_user");
      if (
        this.identitiesByActorId.has(identity.actorId) ||
        this.identitiesByTeamsUserId.has(identity.teamsUserId)
      ) {
        throw new Error("M51B_TEAMS_IDENTITY_DUPLICATE");
      }
      const immutable = deepFreeze({ ...identity });
      this.identitiesByActorId.set(identity.actorId, immutable);
      this.identitiesByTeamsUserId.set(identity.teamsUserId, immutable);
    }
  }

  resolveDestination(destinationId: string): M51BTeamsDestination | null {
    return this.destinationsById.get(destinationId) ?? null;
  }

  resolveIdentityByActor(actorId: string): M51BTeamsIdentity | null {
    return this.identitiesByActorId.get(actorId) ?? null;
  }

  resolveIdentityByTeamsUser(teamsUserId: string): M51BTeamsIdentity | null {
    return this.identitiesByTeamsUserId.get(teamsUserId) ?? null;
  }

  listDestinations(): readonly M51BTeamsDestination[] {
    return deepFreeze(
      [...this.destinationsById.values()].sort((left, right) =>
        left.destinationId.localeCompare(right.destinationId),
      ),
    );
  }

  listIdentities(): readonly M51BTeamsIdentity[] {
    return deepFreeze(
      [...this.identitiesByActorId.values()].sort((left, right) =>
        left.actorId.localeCompare(right.actorId),
      ),
    );
  }
}

