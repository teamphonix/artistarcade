"use client";

import { FormEvent, useState } from "react";

type WaitlistFormProps = {
  className?: string;
  buttonClassName?: string;
  inputClassName?: string;
  buttonLabel?: string;
};

export function WaitlistForm({
  className = "",
  buttonClassName = "",
  inputClassName = "",
  buttonLabel = "BECOME A LEGEND",
}: WaitlistFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not join waitlist.");
      }

      setStatus("success");
      setMessage("You are in. The arena will call.");
      setEmail("");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    }
  }

  return (
    <form className={`waitlist-form ${className}`} onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor={`email-${buttonLabel.replace(/\s+/g, "-").toLowerCase()}`}>
        Email address
      </label>
      <input
        id={`email-${buttonLabel.replace(/\s+/g, "-").toLowerCase()}`}
        className={`waitlist-input ${inputClassName}`}
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="ENTER YOUR EMAIL ADDRESS"
        autoComplete="email"
        required
      />
      <button className={`waitlist-button ${buttonClassName}`} type="submit" disabled={status === "loading"}>
        {status === "loading" ? "ENTERING..." : buttonLabel}
      </button>
      <p className={`waitlist-status ${status === "error" ? "is-error" : ""}`} aria-live="polite">
        {message}
      </p>
    </form>
  );
}
