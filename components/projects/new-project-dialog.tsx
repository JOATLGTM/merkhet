"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createCustomerAction } from "@/app/actions/customers";
import { createProjectAction } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Customer } from "@/lib/types";

type NewProjectDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	customers: Customer[];
};

/** Sentinel option that swaps the picker for the inline create form. */
const NEW_CUSTOMER = "__new__";

/** What ticking the box actually means, spelled out with the real values. */
function summariseCustomer(
	creating: boolean,
	newAddress: string,
	newContactName: string,
	selected: Customer | null,
): string {
	const address = creating ? newAddress.trim() : (selected?.address ?? "");
	const contact = creating
		? newContactName.trim()
		: (selected?.contact_name ?? "");
	const parts = [address, contact].filter(Boolean);
	return parts.length
		? `Using ${parts.join(" · ")}`
		: "The customer has no address or contact on file yet.";
}

const labelClass = "font-mono text-[10px] uppercase tracking-[0.16em]";

export function NewProjectDialog({
	open,
	onOpenChange,
	customers,
}: NewProjectDialogProps) {
	const router = useRouter();
	const [pending, startTransition] = useTransition();
	const [name, setName] = useState("");
	const [customerId, setCustomerId] = useState(
		customers[0]?.id ?? NEW_CUSTOMER,
	);
	const [description, setDescription] = useState("");
	const [error, setError] = useState<string | null>(null);

	// Inline customer fields, only used when customerId === NEW_CUSTOMER
	const [newName, setNewName] = useState("");
	const [newAddress, setNewAddress] = useState("");
	const [newContactName, setNewContactName] = useState("");
	const [newContactEmail, setNewContactEmail] = useState("");
	const [newContactPhone, setNewContactPhone] = useState("");

	/**
	 * Most projects sit at the customer's own address and ring their phone, so
	 * that is the default and the override is opt-in. Unticking reveals four
	 * fields; anything left blank still falls back per field, which is why
	 * nothing here is stored as a flag (`lib/contact.ts`).
	 */
	const [sameAsCustomer, setSameAsCustomer] = useState(true);
	const [siteAddress, setSiteAddress] = useState("");
	const [siteContactName, setSiteContactName] = useState("");
	const [siteContactEmail, setSiteContactEmail] = useState("");
	const [siteContactPhone, setSiteContactPhone] = useState("");

	const creatingCustomer = customerId === NEW_CUSTOMER;
	const selectedCustomer = customers.find((c) => c.id === customerId) ?? null;

	/**
	 * Base UI's <Select.Value> renders the raw selected value unless the Root
	 * is given an items map — unlike Radix, it does not mirror the chosen
	 * <SelectItem>'s children into the trigger.
	 */
	const customerItems = useMemo(
		() => [
			...customers.map((c) => ({ label: c.name, value: c.id })),
			{ label: "+ New customer", value: NEW_CUSTOMER },
		],
		[customers],
	);

	const resetCustomerFields = () => {
		setNewName("");
		setNewAddress("");
		setNewContactName("");
		setNewContactEmail("");
		setNewContactPhone("");
	};

	const resetSiteFields = () => {
		setSameAsCustomer(true);
		setSiteAddress("");
		setSiteContactName("");
		setSiteContactEmail("");
		setSiteContactPhone("");
	};

	/** Blank stays null — null is what makes a field inherit. */
	const orNull = (value: string) => value.trim() || null;

	const submit = () => {
		if (!name.trim()) {
			setError("Project name is required.");
			return;
		}
		if (creatingCustomer && !newName.trim()) {
			setError("Customer name is required.");
			return;
		}
		if (!creatingCustomer && !customerId) {
			setError("Select a customer.");
			return;
		}
		const email = newContactEmail.trim();
		if (creatingCustomer && email && !email.includes("@")) {
			setError("Enter a valid contact email.");
			return;
		}
		const siteEmail = siteContactEmail.trim();
		if (!sameAsCustomer && siteEmail && !siteEmail.includes("@")) {
			setError("Enter a valid project contact email.");
			return;
		}

		startTransition(async () => {
			try {
				// Create the customer first so the project has something to reference.
				// createCustomerAction revalidates /customers, so the new record shows
				// up in the Customers tab without a manual reload.
				const targetCustomerId = creatingCustomer
					? (
							await createCustomerAction({
								name: newName.trim(),
								address: newAddress.trim() || null,
								contact_name: newContactName.trim() || null,
								contact_email: email || null,
								contact_phone: newContactPhone.trim() || null,
							})
						).id
					: customerId;

				const project = await createProjectAction({
					name: name.trim(),
					customer_id: targetCustomerId,
					description: description.trim() || null,
					status: "pending",
					// "Same as customer" is the absence of these, not a flag.
					project_address: sameAsCustomer
						? null
						: orNull(siteAddress),
					project_contact_name: sameAsCustomer
						? null
						: orNull(siteContactName),
					project_contact_email: sameAsCustomer
						? null
						: orNull(siteContactEmail),
					project_contact_phone: sameAsCustomer
						? null
						: orNull(siteContactPhone),
				});

				onOpenChange(false);
				setName("");
				setDescription("");
				setError(null);
				resetCustomerFields();
				resetSiteFields();
				setCustomerId(targetCustomerId);
				router.push(`/?project=${project.id}`);
				router.refresh();
			} catch (e) {
				setError(
					e instanceof Error ? e.message : "Could not create project",
				);
			}
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>New project</DialogTitle>
				</DialogHeader>
				<div className="flex flex-col gap-4">
					<div className="space-y-2">
						<Label className={labelClass}>Name</Label>
						<Input
							value={name}
							onChange={(e) => setName(e.target.value)}
						/>
					</div>

					<div className="space-y-2">
						<Label className={labelClass}>Customer</Label>
						<Select
							items={customerItems}
							value={customerId}
							onValueChange={(v) => {
								setCustomerId(v ?? "");
								setError(null);
							}}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Select customer" />
							</SelectTrigger>
							<SelectContent>
								{customers.map((c) => (
									<SelectItem key={c.id} value={c.id}>
										{c.name}
									</SelectItem>
								))}
								<SelectItem value={NEW_CUSTOMER}>
									+ New customer
								</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{creatingCustomer && (
						<div className="space-y-3 border border-rule bg-paper p-3">
							<p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">
								New customer
							</p>
							<div className="space-y-2">
								<Label
									className={labelClass}
									htmlFor="np-customer-name"
								>
									Customer name
								</Label>
								<Input
									id="np-customer-name"
									value={newName}
									onChange={(e) => setNewName(e.target.value)}
								/>
							</div>
							<div className="space-y-2">
								<Label
									className={labelClass}
									htmlFor="np-customer-address"
								>
									Address
								</Label>
								<Input
									id="np-customer-address"
									value={newAddress}
									onChange={(e) =>
										setNewAddress(e.target.value)
									}
								/>
							</div>
							<div className="space-y-2">
								<Label
									className={labelClass}
									htmlFor="np-contact-name"
								>
									Contact name
								</Label>
								<Input
									id="np-contact-name"
									value={newContactName}
									onChange={(e) =>
										setNewContactName(e.target.value)
									}
								/>
							</div>
							<div className="space-y-2">
								<Label
									className={labelClass}
									htmlFor="np-contact-email"
								>
									Contact email
								</Label>
								<Input
									id="np-contact-email"
									type="email"
									value={newContactEmail}
									onChange={(e) =>
										setNewContactEmail(e.target.value)
									}
								/>
							</div>
							<div className="space-y-2">
								<Label
									className={labelClass}
									htmlFor="np-contact-phone"
								>
									Contact phone
								</Label>
								<Input
									id="np-contact-phone"
									value={newContactPhone}
									onChange={(e) =>
										setNewContactPhone(e.target.value)
									}
								/>
							</div>
						</div>
					)}

					<div className="space-y-3 border border-rule bg-paper p-3">
						<label className="flex items-start gap-2.5">
							<Checkbox
								className="mt-0.5"
								checked={sameAsCustomer}
								onCheckedChange={(checked) =>
									setSameAsCustomer(Boolean(checked))
								}
							/>
							<span>
								<span className="block text-[13px] text-ink">
									Project address and contact are the same as
									the customer
								</span>
								<span className="mt-0.5 block text-[12px] text-ink-soft">
									{sameAsCustomer
										? summariseCustomer(
												creatingCustomer,
												newAddress,
												newContactName,
												selectedCustomer,
											)
										: "Fill in only what differs — anything left blank still uses the customer's."}
								</span>
							</span>
						</label>

						{!sameAsCustomer && (
							<div className="space-y-3 border-t border-rule pt-3">
								<div className="space-y-2">
									<Label
										className={labelClass}
										htmlFor="np-site-address"
									>
										Project address
									</Label>
									<Input
										id="np-site-address"
										value={siteAddress}
										onChange={(e) =>
											setSiteAddress(e.target.value)
										}
									/>
								</div>
								<div className="space-y-2">
									<Label
										className={labelClass}
										htmlFor="np-site-contact"
									>
										Project contact
									</Label>
									<Input
										id="np-site-contact"
										value={siteContactName}
										onChange={(e) =>
											setSiteContactName(e.target.value)
										}
									/>
								</div>
								<div className="space-y-2">
									<Label
										className={labelClass}
										htmlFor="np-site-email"
									>
										Project email
									</Label>
									<Input
										id="np-site-email"
										type="email"
										value={siteContactEmail}
										onChange={(e) =>
											setSiteContactEmail(e.target.value)
										}
									/>
								</div>
								<div className="space-y-2">
									<Label
										className={labelClass}
										htmlFor="np-site-phone"
									>
										Project phone
									</Label>
									<Input
										id="np-site-phone"
										value={siteContactPhone}
										onChange={(e) =>
											setSiteContactPhone(e.target.value)
										}
									/>
								</div>
							</div>
						)}
					</div>

					<div className="space-y-2">
						<Label className={labelClass}>Description</Label>
						<Textarea
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							rows={3}
						/>
					</div>

					{error && (
						<p className="text-[13px] text-redline">{error}</p>
					)}

					<Button
						onClick={submit}
						disabled={pending}
						className="rounded-[3px] bg-ink text-surface"
					>
						{pending ? "Creating…" : "Create project"}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
