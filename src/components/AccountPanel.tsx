"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import Btn from "@/components/Btn";
import ConfirmModal from "@/components/ConfirmModal";
import { pad2 } from "@/lib/format";
import type { Me } from "@/lib/types";

const AUTH_ERRORS: Record<string, string> = {
  unconfigured: "Google sign-in is not configured on this server yet.",
  cancelled: "Sign-in was cancelled.",
  handshake: "That sign-in link expired. Try again.",
  state: "Sign-in could not be verified. Try again.",
  exchange: "Google rejected the sign-in. Try again.",
  domain: "Use your BITS email address to sign in.",
  storage:
    "The server cannot save sign-ins right now. This is a setup problem, not you — tell the organisers.",
};

type Props = {
  me: Me;
  /** Re-fetch /api/me after anything that changes the session or team. */
  onChanged: () => void;
};

export default function AccountPanel({ me, onChanged }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  // Read straight off the URL that the OAuth callback redirected to.
  const authErrorCode = params.get("authError");
  const authError = authErrorCode
    ? (AUTH_ERRORS[authErrorCode] ?? "Sign-in failed. Try again.")
    : null;

  const [mode, setMode] = useState<"create" | "join">("create");
  const [teamName, setTeamName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entering, setEntering] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const [working, setWorking] = useState(false);

  const post = useCallback(
    async (url: string, body?: unknown) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body ?? {}),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "That did not work.");
          return false;
        }
        onChanged();
        return true;
      } catch {
        setError("Could not reach the server.");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [onChanged],
  );

  // A preview pass opens the terminal without opening the event.
  const open = me.event.phase === "open" || me.preview;

  /* ------------------------------ signed out ---------------------- */

  if (!me.user) {
    return (
      <div className="panel notch brackets w-full p-5 sm:p-7" id="join">
        <p className="text-[10px] tracked text-phos glow">Registration</p>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-dim">
          Sign in with your BITS Google account. One account per person —
          create a team or join your captain&apos;s with their code.
        </p>

        {authError && (
          <p role="alert" className="mt-4 text-[13px] text-danger">
            {authError}
          </p>
        )}

        {!me.storageReady ? (
          <p className="mt-6 border border-danger/40 bg-danger/5 px-4 py-3 text-[12px] leading-relaxed text-danger">
            This deployment has no database, so nothing can be saved yet.
            Registration is closed until the organisers set DATABASE_URL.
          </p>
        ) : me.auth.google ? (
          <a href="/api/auth/start" className="btn notch mt-6 flex w-full gap-3">
            <GoogleMark />
            Sign in with Google
          </a>
        ) : (
          <p className="mt-6 border border-amber/30 bg-amber/5 px-4 py-3 text-[12px] leading-relaxed text-amber">
            Google sign-in is not configured on this server. Set
            GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.
          </p>
        )}

        {me.auth.mock && me.storageReady && <MockSignIn onDone={onChanged} />}

        <p className="mt-4 text-[10px] leading-relaxed tracked text-ink-dim">
          We store your name, email and team only.
        </p>
      </div>
    );
  }

  /* ---------------------------- no team yet ----------------------- */

  if (!me.team) {
    return (
      <div className="panel notch brackets w-full p-5 sm:p-7" id="join">
        <Who me={me} onSignOut={() => setConfirmOut(true)} />

        <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden border border-phos/20 bg-phos/20">
          {(["create", "join"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={`px-3 py-2.5 text-[10px] tracked transition-colors ${
                mode === m
                  ? "bg-phos/15 text-phos"
                  : "bg-panel text-ink-dim hover:text-phos"
              }`}
            >
              {m === "create" ? "Create a team" : "Join with code"}
            </button>
          ))}
        </div>

        {mode === "create" ? (
          <form
            className="mt-5"
            onSubmit={async (e) => {
              e.preventDefault();
              await post("/api/team/create", { name: teamName });
            }}
          >
            <label
              htmlFor="teamName"
              className="mb-1.5 block text-[10px] tracked text-ink-dim"
            >
              Team name
            </label>
            <input
              id="teamName"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              required
              minLength={3}
              maxLength={28}
              placeholder="e.g. NIGHT SHIFT"
              className="field notch"
            />
            <p className="mt-2 text-[10px] tracked text-ink-dim">
              You get a join code to share · up to {me.maxTeamSize} members
            </p>
            <Btn type="submit" loading={busy} loadingLabel="Creating" className="mt-5 w-full">
              Create team
            </Btn>
          </form>
        ) : (
          <form
            className="mt-5"
            onSubmit={async (e) => {
              e.preventDefault();
              await post("/api/team/join", { code });
            }}
          >
            <label
              htmlFor="joinCode"
              className="mb-1.5 block text-[10px] tracked text-ink-dim"
            >
              Join code
            </label>
            <input
              id="joinCode"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
              maxLength={12}
              autoCapitalize="characters"
              autoComplete="off"
              placeholder="ABC-123"
              className="field notch text-center text-lg tracking-[0.4em]"
            />
            <p className="mt-2 text-[10px] tracked text-ink-dim">
              Ask your captain for the code
            </p>
            <Btn type="submit" loading={busy} loadingLabel="Joining" className="mt-5 w-full">
              Join team
            </Btn>
          </form>
        )}

        {error && (
          <p role="alert" className="mt-4 text-[13px] text-danger">
            {error}
          </p>
        )}

        <SignOutModal
          open={confirmOut}
          loading={working}
          onCancel={() => setConfirmOut(false)}
          onConfirm={async () => {
            setWorking(true);
            await fetch("/api/auth/signout", { method: "POST" });
            setWorking(false);
            setConfirmOut(false);
            onChanged();
          }}
        />
      </div>
    );
  }

  /* ------------------------------ on a team ----------------------- */

  const team = me.team;

  return (
    <>
      <div className="panel notch brackets w-full p-5 sm:p-7" id="join">
        <Who me={me} onSignOut={() => setConfirmOut(true)} />

        <p className="mt-5 truncate text-2xl text-phos glow">{team.name}</p>

        <div className="mt-4 flex items-center gap-3 border border-phos/20 bg-panel-2 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[9px] tracked text-ink-dim">Join code</p>
            <p className="text-xl tracking-[0.3em] text-phos glow">{team.code}</p>
          </div>
          <CopyCode code={team.code} />
        </div>

        <div className="mt-5">
          <p className="text-[10px] tracked text-ink-dim">
            Members {pad2(team.members.length)}/{pad2(me.maxTeamSize)}
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {team.members.map((m) => (
              <li
                key={m.email}
                className="flex items-baseline gap-2 border-l-2 border-l-phos/25 pl-3"
              >
                <span className="truncate text-[13px] text-ink">{m.name}</span>
                {m.isCaptain && (
                  <span className="text-[9px] tracked text-amber">captain</span>
                )}
                {m.isYou && <span className="text-[9px] tracked text-phos/70">you</span>}
              </li>
            ))}
          </ul>
        </div>

        {open ? (
          <Btn
            type="button"
            loading={entering}
            loadingLabel="Connecting"
            onClick={() => {
              setEntering(true);
              router.push("/hunt");
            }}
            className="mt-6 w-full"
          >
            {team.solved > 0 ? "Resume the hunt" : "Enter the terminal"}
          </Btn>
        ) : (
          <div className="mt-6 border border-amber/30 bg-amber/5 px-4 py-3 text-center">
            <p className="text-[11px] tracked text-amber">
              {me.event.phase === "before"
                ? "You are registered · the terminal unlocks at the start"
                : "The hunt has closed"}
            </p>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 text-[13px] text-danger">
            {error}
          </p>
        )}

        {me.event.phase === "before" && (
          <button
            type="button"
            onClick={() => setConfirmLeave(true)}
            className="mt-4 block w-full text-center text-[10px] tracked text-ink-dim underline-offset-4 transition-colors hover:text-danger hover:underline"
          >
            Leave this team
          </button>
        )}
      </div>

      <ConfirmModal
        open={confirmLeave}
        title="Leave this team?"
        body={
          team.members.length === 1
            ? "You are the only member, so the team will be deleted and its name and join code released."
            : "You will be removed from the team. You can rejoin with the same code, or create your own."
        }
        confirmLabel="Leave team"
        confirmingLabel="Leaving"
        cancelLabel="Stay"
        tone="danger"
        loading={working}
        onConfirm={async () => {
          setWorking(true);
          await post("/api/team/leave");
          setWorking(false);
          setConfirmLeave(false);
        }}
        onCancel={() => setConfirmLeave(false)}
      />

      <SignOutModal
        open={confirmOut}
        loading={working}
        onCancel={() => setConfirmOut(false)}
        onConfirm={async () => {
          setWorking(true);
          await fetch("/api/auth/signout", { method: "POST" });
          setWorking(false);
          setConfirmOut(false);
          onChanged();
        }}
      />
    </>
  );
}

/* -------------------------------- pieces -------------------------- */

function Who({ me, onSignOut }: { me: Me; onSignOut: () => void }) {
  if (!me.user) return null;
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className="grid h-8 w-8 shrink-0 place-items-center border border-phos/30 text-[13px] text-phos"
      >
        {me.user.name.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] text-ink">{me.user.name}</p>
        <p className="truncate text-[10px] text-ink-dim">{me.user.email}</p>
      </div>
      <button
        type="button"
        onClick={onSignOut}
        className="shrink-0 text-[10px] tracked text-ink-dim underline-offset-4 transition-colors hover:text-danger hover:underline"
      >
        Sign out
      </button>
    </div>
  );
}

function CopyCode({ code }: { code: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {
          /* clipboard blocked — the code is on screen anyway */
        }
      }}
      className="notch ml-auto shrink-0 border border-phos/30 px-3 py-2 text-[10px] tracked text-phos transition-colors hover:border-phos hover:bg-phos/10"
    >
      {done ? "Copied" : "Copy"}
    </button>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1 .7-2.4 1.1-4 1.1-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.4 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.4a12 12 0 0 0 0 10.8l4-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.5-3.5C17.9 1.2 15.2 0 12 0A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"
      />
    </svg>
  );
}

function SignOutModal(props: {
  open: boolean;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <ConfirmModal
      open={props.open}
      title="Sign out?"
      body="This closes the session in this browser. Your team and its progress are kept — sign back in with the same Google account to return."
      confirmLabel="Sign out"
      confirmingLabel="Closing"
      cancelLabel="Cancel"
      tone="danger"
      loading={props.loading}
      onConfirm={props.onConfirm}
      onCancel={props.onCancel}
    />
  );
}

/** Only rendered when the server reports mock auth is on (never in prod). */
function MockSignIn({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-6 border border-amber/30 bg-amber/5 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await fetch("/api/auth/mock", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email }),
        });
        setBusy(false);
        onDone();
      }}
    >
      <p className="text-[10px] tracked text-amber">Dev sign-in (mock)</p>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@pilani.bits-pilani.ac.in"
        className="field notch mt-2 text-[12px]"
      />
      <Btn type="submit" variant="ghost" loading={busy} className="mt-3 w-full">
        Sign in without Google
      </Btn>
    </form>
  );
}
