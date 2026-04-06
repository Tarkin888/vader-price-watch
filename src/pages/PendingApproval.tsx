import { useAuth } from "@/hooks/use-auth";
import { Clock, XCircle } from "lucide-react";

const PendingApproval = () => {
  const { profile, signOut } = useAuth();
  const isRejected = profile?.status === "rejected";

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#080806" }}>
      <div
        className="w-full max-w-[420px] mx-4 rounded-lg text-center px-8 py-10"
        style={{
          border: "1px solid rgba(201,168,76,0.3)",
          background: "#0D0D0B",
          boxShadow: "0 0 40px rgba(201,168,76,0.05)",
        }}
      >
        <h1 className="text-lg font-bold tracking-[3px] mb-6" style={{ color: "#C9A84C", fontFamily: "Courier New, monospace" }}>
          IMPERIAL PRICE TERMINAL
        </h1>

        {isRejected ? (
          <>
            <XCircle className="mx-auto mb-4" style={{ color: "#8B0000" }} size={48} />
            <p className="text-lg font-bold mb-2" style={{ color: "#e0d8c0" }}>
              Access request declined
            </p>
            <p className="text-sm leading-relaxed mb-2" style={{ color: "#e0d8c0", opacity: 0.7 }}>
              Your request to access the Imperial Price Terminal was not approved.
            </p>
            {profile?.rejection_reason && (
              <p className="text-sm mt-2 px-4 py-2 rounded" style={{ color: "#e0d8c0", opacity: 0.8, background: "rgba(139,0,0,0.15)" }}>
                Reason: {profile.rejection_reason}
              </p>
            )}
          </>
        ) : (
          <>
            <Clock className="mx-auto mb-4" style={{ color: "#C9A84C" }} size={48} />
            <p className="text-lg font-bold mb-2" style={{ color: "#e0d8c0" }}>
              Your account is pending approval
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "#e0d8c0", opacity: 0.7 }}>
              The administrator has been notified of your registration. You'll receive an email once your access has been reviewed.
            </p>
          </>
        )}

        <button
          onClick={signOut}
          className="mt-8 px-6 py-3 rounded text-xs font-bold tracking-widest"
          style={{
            border: "1px solid #C9A84C",
            color: "#C9A84C",
            background: "transparent",
            minHeight: 44,
          }}
        >
          SIGN OUT
        </button>
      </div>
    </div>
  );
};

export default PendingApproval;
