import { AuthShell } from "@/components/auth/auth-shell";
import { SetPasswordForm } from "@/components/auth/set-password-form";

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <SetPasswordForm
        copy={{
          title: "Choose a new password",
          expiredTitle: "Reset link expired",
          expiredHelp: "Request a new one from the sign-in page.",
          submitLabel: "Save password",
        }}
      />
    </AuthShell>
  );
}
