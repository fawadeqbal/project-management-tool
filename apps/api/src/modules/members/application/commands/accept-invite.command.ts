export class AcceptInviteCommand {
  constructor(
    readonly userId: string,
    readonly token: string,
  ) {}
}
