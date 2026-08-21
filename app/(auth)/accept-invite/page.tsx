import { AuthShell } from "@/components/auth/auth-shell";
import { SetPasswordForm } from "@/components/auth/set-password-form";

export default function AcceptInvitePage() {
  return (
    <AuthShell>
      <SetPasswordForm
        copy={{
          title: "Set your password",
          expiredTitle: "Invite link expired",
          expiredHelp: "Ask an admin to send you a new invite.",
          submitLabel: "Set password and continue",
        }}
      />
    </AuthShell>
  );
}
