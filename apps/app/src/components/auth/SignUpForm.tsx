import { useState, type ComponentProps } from "react";
import { authClient } from "../../lib/auth-client.js";

const PASSWORD_MIN_LENGTH = 8;
type FormSubmitHandler = NonNullable<ComponentProps<"form">["onSubmit"]>;

export default function SignUpForm() {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const handleSubmit: FormSubmitHandler = async (event) => {
		event.preventDefault();
		setError(null);

		if (name.trim().length < 2) {
			setError("Name must be at least 2 characters.");
			return;
		}

		if (!email || password.length < PASSWORD_MIN_LENGTH) {
			setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
			return;
		}

		setSubmitting(true);
		await authClient.signUp.email(
			{
				name: name.trim(),
				email,
				password,
			},
			{
				onSuccess: () => {
					window.location.href = "/";
				},
				onError: (context) => {
					setError(context.error.message || "Sign up failed.");
					setSubmitting(false);
				},
			},
		);
	};

	return (
		<form className="auth-form" onSubmit={handleSubmit}>
			<div className="field">
				<label htmlFor="name">Name</label>
				<input
					id="name"
					type="text"
					value={name}
					onChange={(event) => setName(event.target.value)}
					placeholder="Ada Lovelace"
					required
				/>
			</div>

			<div className="field">
				<label htmlFor="email">Email</label>
				<input
					id="email"
					type="email"
					value={email}
					onChange={(event) => setEmail(event.target.value)}
					placeholder="you@company.com"
					required
				/>
			</div>

			<div className="field">
				<label htmlFor="password">Password</label>
				<input
					id="password"
					type="password"
					value={password}
					onChange={(event) => setPassword(event.target.value)}
					placeholder="Minimum 8 characters"
					required
					minLength={PASSWORD_MIN_LENGTH}
				/>
			</div>

			{error ? <p className="form-error">{error}</p> : null}

			<button className="button" type="submit" disabled={submitting}>
				{submitting ? "Creating account..." : "Create account"}
			</button>
		</form>
	);
}
