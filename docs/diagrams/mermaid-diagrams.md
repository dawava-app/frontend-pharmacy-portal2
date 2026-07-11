# Mermaid Diagram Source — Frontend Chapter, Dawava Pharmacy Portal

Each block corresponds to the figure of the same number in `Graduation_Project_Report.md`. Twelve diagrams in total (Figures 1, 2, 3, 4, 6, 8, 11, 13, 16, 18, 20, 22); the remaining figure numbers are screenshot placeholders described directly in the report text.

## Figure 1 – Overall System Architecture

```mermaid
flowchart TB
  subgraph Client["Single-Page Client Application"]
    UI["Feature Modules<br/>(Registration, Administration, Manager,<br/>Staff, Settings, Inventory, Sales, Communication)"]
    AUTHL["Request Authentication Layer"]
    RTC["Real-Time Messaging Client"]
  end

  subgraph Backend["Backend Services"]
    CORE["Identity and Core Service<br/>(accounts, pharmacies, branches, applications,<br/>staff, roles, inventory)"]
    FILE["File Handling Service"]
    COMM["Communication Service<br/>(message history + real-time gateway)"]
  end

  UI --> AUTHL
  UI --> RTC
  AUTHL -->|REST| CORE
  AUTHL -->|REST| FILE
  AUTHL -->|REST| COMM
  RTC <-->|Persistent Connection| COMM
```

## Figure 2 – Frontend Modular Architecture

```mermaid
flowchart TD
  CORE["Core Layer<br/>Authentication state, route protection,<br/>cross-cutting services"]
  SHARED["Shared Layer<br/>Domain services and reusable<br/>presentational components"]
  SHELL["Application Shell<br/>Persistent navigation chrome"]
  REG["Registration Module"]
  ADM["Administration Module"]
  MGR["Manager Module"]
  STAFF["Staff Module"]
  SET["Settings Module"]
  INV["Inventory Module"]
  SALES["Sales Module"]
  COMM["Communication Module"]
  STAFFMGT["Staff Management<br/>(shared: Admin + Manager)"]

  SHARED --> CORE
  SHELL --> CORE
  SHELL --> SHARED
  REG --> CORE
  MGR --> CORE
  MGR --> SHARED
  STAFF --> CORE
  STAFF --> SHARED
  SET --> CORE
  SET --> SHARED
  INV --> CORE
  SALES --> CORE
  COMM --> CORE
  ADM --> CORE
  ADM --> SHARED
  ADM -.->|documented dependency| REG
  ADM -.->|shared component| STAFFMGT
  MGR -.->|shared component| STAFFMGT
```

## Figure 3 – Authentication and Session Flow

```mermaid
sequenceDiagram
  participant U as User
  participant C as Client Application
  participant I as Identity Service

  U->>C: submit credentials
  C->>I: forward sign-in request
  I-->>C: access and refresh tokens, workspace scope
  C->>C: resolve branch/pharmacy context from token
  C->>I: request account and role information
  I-->>C: profile and role indicators
  C->>C: determine operating role
  C-->>U: redirect to role-appropriate dashboard

  Note over C,I: On a later expired-token response,<br/>the client renews the token pair<br/>and retries transparently before the user notices
```

## Figure 4 – Role-Based Access Control Flow

```mermaid
flowchart TD
  Nav["User navigates to a role-scoped area"] --> SC{"Session Check:<br/>valid credentials present?"}
  SC -- No --> Login["Redirect to sign-in screen"]
  SC -- Yes --> RC{"Role Check:<br/>role already resolved?"}
  RC -- "Not yet" --> Wait["Wait, within a bounded period,<br/>for role resolution to complete"]
  Wait -->|timeout| Login
  Wait -->|resolved| RC2{"Does role match<br/>the required role?"}
  RC -- Yes --> RC2
  RC2 -- Yes --> Allow["Allow: render requested area"]
  RC2 -- No --> Redirect["Redirect to user's own dashboard"]
```

## Figure 6 – Onboarding Application Workflow

```mermaid
flowchart TD
  Start(["Applicant begins registration"]) --> S1["Stage 1: Organizational Details"]
  S1 --> S2["Stage 2: Branch Information<br/>(interactive map geolocation)"]
  S2 --> S3["Stage 3: Ownership Details"]
  S3 --> S4["Stage 4: Supporting Documents"]
  S4 --> S5["Stage 5: Review and Submit"]
  S5 --> UR["Status: Under Review"]
  UR --> Decision{"Administrator Decision"}
  Decision -- Approved --> Appr(["Approval Outcome:<br/>Manager access granted"])
  Decision -- Rejected --> Rej(["Rejection Outcome:<br/>Reason shown, may re-apply"])

  Note1["Progress is preserved locally between stages,<br/>so an interrupted registration can be resumed"]
  S2 -.-> Note1
```

## Figure 8 – Administrator Review and Approval Workflow

```mermaid
sequenceDiagram
  participant A as Administrator
  participant L as Application Listing
  participant D as Application Detail
  participant B as Backend Services

  A->>L: open application listing
  L->>B: request submitted applications
  B-->>L: application summaries
  A->>D: open a specific application
  D->>B: request full application detail
  B-->>D: organizational, ownership, branch, document data
  A->>D: inspect a supporting document
  D->>B: resolve viewable document link
  B-->>D: document opened for review
  A->>D: record decision (approve or reject)
  D->>B: submit decision
  B-->>D: updated application status
  D-->>A: confirmation and refreshed status
```

## Figure 11 – Branch and Pharmacy Management Workflow

```mermaid
flowchart TD
  Mgr(["Manager opens account settings"]) --> Role{"Manager role?"}
  Role -- No --> RO["Read-only pharmacy and branch view"]
  Role -- Yes --> Actions["Administrative capabilities"]
  Actions --> A1["Edit pharmacy identity<br/>(name, photograph)"]
  Actions --> A2["Designate default branch<br/>for future sign-ins"]
  Actions --> A3["Create, edit, or remove branches<br/>(address, map location, photograph)"]
  A1 --> Sync["Synchronized update across<br/>navigation bar, workspace switcher,<br/>and dashboards"]
  A2 --> Sync
  A3 --> Sync
```

## Figure 13 – Real-Time Chat Communication Workflow

```mermaid
sequenceDiagram
  participant S as Sender
  participant CI as Chat Interface
  participant MS as Messaging Service
  participant RG as Real-Time Gateway
  participant R as Recipient

  S->>CI: compose and send message
  CI->>CI: display message immediately (optimistic update)
  CI->>MS: submit message
  MS-->>CI: confirmed message record
  MS-->>RG: broadcast new-message event
  RG-->>R: deliver message in real time
  R-->>RG: acknowledge read
  RG-->>CI: read receipt delivered to sender

  Note over CI,RG: The same real-time channel also carries<br/>typing indicators, presence, and voice-message delivery
```

## Figure 16 – Inventory and Sales Data Workflow

```mermaid
flowchart TD
  U(["Manager or Staff opens Inventory / Sales"]) --> Branch["Scope to currently active branch"]
  Branch --> Summary["Load summary figures<br/>(stock position or transaction stats)"]
  Branch --> List["Load searchable, filterable,<br/>paginated item/transaction list"]
  List --> Filter["Apply search, status/source,<br/>or date-range filters"]
  Filter --> List
  List --> Export{"Export or Print?"}
  Export -- "Export" --> Files["Generate PDF, Excel, or CSV<br/>of the filtered data set"]
  Export -- "Print (Sales only)" --> Select["Select one or more transactions"]
  Select --> Receipt["Generate formatted receipt<br/>and open browser print dialog"]
  Switch["Workspace switch to a different branch"] -.->|triggers reload| Branch
```

## Figure 18 – Staff Invitation Lifecycle

```mermaid
flowchart TD
  Gen(["Manager/Admin: Generate invitation link"]) --> Cfg["Select role, branch(es), expiry period"]
  Cfg --> Link["Invitation link created and shown for copying"]
  Link --> Pending["Listed under Pending Invitations<br/>(revocable at any time)"]
  Pending -->|revoked before use| Revoked(["Invitation Revoked"])
  Link --> Open(["Recipient opens invitation link"])
  Open --> Auth{"Signed in?"}
  Auth -- No --> SignIn["Redirect to sign-in,<br/>then return to invitation"]
  SignIn --> Validate
  Auth -- Yes --> Validate["Validate invitation token"]
  Validate --> Preview["Preview: pharmacy, branch(es), role, expiry"]
  Preview --> Decision{"Accept or Decline?"}
  Decision -- Accept --> Grant["Branch assignment created;<br/>session refreshed with new access"]
  Grant --> Dash(["Redirect to role-appropriate dashboard"])
  Decision -- Decline --> End(["Invitation flow ends;<br/>roster unaffected"])
```

## Figure 20 – Role and Permission Management Workflow

```mermaid
flowchart TD
  Start(["Admin (platform-wide) or Manager (pharmacy-scoped)<br/>opens Roles & Permissions"]) --> Create["Create role: name + description"]
  Create --> Saved["Role saved (no permissions yet)"]
  Saved --> Assign["Open permission-assignment matrix<br/>grouped by functional module"]
  Assign --> Toggle["Toggle individual permissions<br/>or whole modules at once"]
  Toggle --> Pending["Changes held locally;<br/>pending add/remove count shown"]
  Pending --> Save["Confirm: Save Changes"]
  Save --> Persisted(["Role's permissions updated"])
  Persisted --> Use["Role becomes available when<br/>assigning or inviting staff"]

  Guard["System role or role outside scope?"] -.->|redirects to read-only view| Assign
```

## Figure 22 – Client–Backend Communication and File Handling Flow

```mermaid
sequenceDiagram
  participant C as Interface Component
  participant SL as Service Layer
  participant BE as Backend Service
  participant FH as File Handling Service

  C->>SL: request or submit data
  SL->>BE: forward request (authenticated)
  BE-->>SL: structured response
  SL-->>C: normalized data

  Note over C,FH: File handling (documents, photographs, attachments)
  C->>FH: upload selected file (validated type and size)
  FH-->>C: stored file reference
  C->>BE: associate reference with owning record
  C->>FH: resolve viewable link when display is needed
  FH-->>C: authenticated, viewable file link
```
