import {
  CONTACT_FIELDS,
  PROJECT_CONTACT_COLUMN,
  clearOverridesPatch,
  overriddenCount,
  resolveContact,
  resolveContactField,
  usesCustomerContact,
} from "../lib/contact";

let failures = 0;
const check = (label: string, got: unknown, want: unknown) => {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) {
    failures += 1;
    console.log(`FAIL ${label}\n  got  ${g}\n  want ${w}`);
  } else {
    console.log(`ok   ${label}`);
  }
};

const customer = {
  address: "3417 S Hoyne Ave, Chicago, IL 60608",
  contact_name: "Luis Ortega",
  contact_email: "luis.ortega@example.com",
  contact_phone: "(773) 555-0166",
};

const blank = {
  project_address: null,
  project_contact_name: null,
  project_contact_email: null,
  project_contact_phone: null,
};

// --- the "same as customer" case ----------------------------------------
check("no overrides inherits every field", usesCustomerContact(blank, customer), true);
check("no overrides counts zero", overriddenCount(blank, customer), 0);
check(
  "inherited values come through",
  resolveContact(blank, customer).map((r) => r.value),
  [
    "3417 S Hoyne Ave, Chicago, IL 60608",
    "Luis Ortega",
    "luis.ortega@example.com",
    "(773) 555-0166",
  ],
);
check(
  "nothing reads as overridden",
  resolveContact(blank, customer).map((r) => r.overridden),
  [false, false, false, false],
);

// --- full override -------------------------------------------------------
const full = {
  project_address: "913 W Randolph St, Chicago, IL 60607",
  project_contact_name: "Marco Ruiz",
  project_contact_email: "marco@example.com",
  project_contact_phone: "(312) 555-0182",
};
check("a full override is not 'same as customer'", usesCustomerContact(full, customer), false);
check("a full override counts four", overriddenCount(full, customer), 4);
check(
  "the project's own values win",
  resolveContact(full, customer).map((r) => r.value),
  [
    "913 W Randolph St, Chicago, IL 60607",
    "Marco Ruiz",
    "marco@example.com",
    "(312) 555-0182",
  ],
);

// --- partial override: the whole reason there is no boolean --------------
const partial = {
  project_address: "913 W Randolph St, Chicago, IL 60607",
  project_contact_name: "Marco Ruiz",
  project_contact_email: null,
  project_contact_phone: "(312) 555-0182",
};
check("a partial override is not 'same as customer'", usesCustomerContact(partial, customer), false);
check("a partial override counts three", overriddenCount(partial, customer), 3);
check(
  "the untouched field still falls back",
  resolveContactField("contact_email", partial, customer).value,
  "luis.ortega@example.com",
);
check(
  "and is not marked as an override",
  resolveContactField("contact_email", partial, customer).overridden,
  false,
);
check(
  "an overridden field reports what it replaced",
  resolveContactField("contact_name", partial, customer).inherited,
  "Luis Ortega",
);

// --- blank strings are an empty input, not an override -------------------
const empty = {
  project_address: "",
  project_contact_name: "   ",
  project_contact_email: null,
  project_contact_phone: null,
};
check("an empty string does not override", usesCustomerContact(empty, customer), true);
check("whitespace does not override", overriddenCount(empty, customer), 0);
check(
  "an empty string still shows the customer's value",
  resolveContactField("address", empty, customer).value,
  "3417 S Hoyne Ave, Chicago, IL 60608",
);
check(
  "a real value is trimmed",
  resolveContactField("address", { ...blank, project_address: "  1 Main St  " }, customer).value,
  "1 Main St",
);

// --- neither side has anything ------------------------------------------
const bareCustomer = {
  address: null,
  contact_name: null,
  contact_email: null,
  contact_phone: null,
};
check(
  "missing on both sides resolves to null",
  resolveContact(blank, bareCustomer).map((r) => r.value),
  [null, null, null, null],
);
check(
  "an empty customer still counts as 'same as'",
  usesCustomerContact(blank, bareCustomer),
  true,
);
check(
  "a project value survives an empty customer",
  resolveContactField("address", { ...blank, project_address: "1 Main St" }, bareCustomer),
  { field: "address", value: "1 Main St", overridden: true, inherited: null },
);

// --- shape ---------------------------------------------------------------
check("four fields, in display order", CONTACT_FIELDS, [
  "address",
  "contact_name",
  "contact_email",
  "contact_phone",
]);
check("every field maps to a project column", Object.keys(PROJECT_CONTACT_COLUMN).length, 4);
check("clearing nulls all four columns", clearOverridesPatch(), {
  project_address: null,
  project_contact_name: null,
  project_contact_email: null,
  project_contact_phone: null,
});
check(
  "clearing returns a project to 'same as customer'",
  usesCustomerContact({ ...full, ...clearOverridesPatch() }, customer),
  true,
);

console.log(
  failures === 0 ? "\ncontact: all checks passed" : `\ncontact: ${failures} FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
