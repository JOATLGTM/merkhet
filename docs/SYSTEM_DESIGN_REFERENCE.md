# System Design Reference

**Purpose:** Working reference for architecture decisions on this project. Written to be scanned, not read start-to-finish.

**Sources indexed:**
1. [karanpratapsingh/system-design](https://github.com/karanpratapsingh/system-design) — CC BY-NC-ND 4.0. Single 5,700-line README, 5 chapters, 45 diagrams. Deep prose on ~45 topics.
2. [ashishps1/awesome-system-design-resources](https://github.com/ashishps1/awesome-system-design-resources) — GPL-3.0. Curated link index + working algorithm implementations (Java/Python) for rate limiting, load balancing, and consistent hashing.

All prose here is original synthesis; no text or code is reproduced from either source. Consult the repos directly for the authors' own treatments.

**Indexed:** 2026-08-10 (v2 — merged source 2). Sections marked 🆕 are new or substantially revised in v2.

---

## Table of Contents

- [0. Decision Cheat Sheet](#0-decision-cheat-sheet)
- [1. Networking Fundamentals](#1-networking-fundamentals)
- [2. Traffic Management](#2-traffic-management)
- [3. Availability & Scalability](#3-availability--scalability)
- [4. Storage & Databases](#4-storage--databases)
- [5. Consistency & Transactions](#5-consistency--transactions)
- [6. Distributing Data](#6-distributing-data)
- [7. Architecture Patterns](#7-architecture-patterns)
- [8. Communication & APIs](#8-communication--apis)
- [9. Reliability Patterns](#9-reliability-patterns)
- [10. Operations & Security](#10-operations--security)
- [11. Interview / Design Framework](#11-interview--design-framework)
- [12. Case Study Playbooks](#12-case-study-playbooks)
- [13. Estimation Cheat Sheet](#13-estimation-cheat-sheet)
- [14. Tradeoffs Reference 🆕](#14-tradeoffs-reference)
- [15. Algorithm Implementations 🆕](#15-algorithm-implementations)
- [16. Problem Catalog 🆕](#16-problem-catalog)
- [17. Further Reading 🆕](#17-further-reading)

---

## 0. Decision Cheat Sheet

Fast lookups for the questions that come up most while building.

| Question | Default answer | Switch when |
|---|---|---|
| SQL or NoSQL? | SQL | Schema is genuinely fluid, no joins needed, or write throughput exceeds what one primary can take |
| Scale up or out? | Up first (simpler) | You hit a ceiling, need redundancy, or downtime during upgrades is unacceptable |
| Monolith or microservices? | Modular monolith | Team is too large for one codebase and teams are blocking each other — an org problem, not a tech one |
| REST, GraphQL, or gRPC? | REST | GraphQL for varied client data needs; gRPC for internal service-to-service |
| Push or pull for real-time? | WebSockets (push) | SSE if unidirectional is enough; long polling only for small scale |
| Cache write strategy? | Write-through | Write-back for write-heavy (accepts data-loss risk); write-around when writes are rarely re-read |
| Sync or async processing? | Sync | Any task >100ms that the user doesn't need to wait on → queue it |
| Shard now? | No | Only when a single node genuinely can't hold the data or the load |
| Strong or eventual consistency? | Depends on the write | Money and inventory need strong; feeds, counts, and analytics can be eventual |
| Stateful or stateless services? 🆕 | Stateless | Only when the state genuinely can't be externalized (game servers, long-lived sessions) |
| Batch or stream processing? 🆕 | Batch | Stream when latency requirements are seconds, not hours |
| Cache read strategy? 🆕 | Cache-aside | Read-through when you want the cache layer to own the fetch logic |
| Sync or async service call? 🆕 | Async | Sync only when the caller genuinely needs the result to proceed |
| Need idempotency? 🆕 | Yes, always | Any retried write without an idempotency key is a duplicate waiting to happen |
| Poll or webhook for third-party events? 🆕 | Webhook | Poll when you can't expose an endpoint or need guaranteed ordering |

**Ordering heuristic when scaling:** vertical scale → read replicas → cache → CDN → async queues → shard. Each step buys an order of magnitude and costs complexity. Don't skip ahead.

---

## 1. Networking Fundamentals

### IP

- **IPv4** — 32-bit, dotted decimal, ~4.3B addresses. Exhausted.
- **IPv6** — 128-bit, hex, effectively unlimited (~3.4×10³⁸).
- **Public vs private** — public is what the ISP gives the router; private is what the router gives devices behind NAT.
- **Static vs dynamic** — static is manually assigned, costs more, used for servers and geo-services. Dynamic comes from DHCP, is the common case, and lets addresses be recycled.

### OSI Model (7 layers, top → bottom)

| # | Layer | Job | Unit |
|---|---|---|---|
| 7 | Application | Protocols the app speaks (HTTP, SMTP) | Data |
| 6 | Presentation | Translation, encryption, compression | Data |
| 5 | Session | Opens/closes/checkpoints the conversation | Data |
| 4 | Transport | End-to-end delivery, chunking | Segments |
| 3 | Network | Routing between networks | Packets |
| 2 | Data Link | Transfer within one network | Frames |
| 1 | Physical | Cables, switches, bits on the wire | Bits |

Modern networks run TCP/IP, not literal OSI — but the vocabulary is universal. **The two layers that matter for design: L4 (IP/port routing) and L7 (content-aware routing).**

### TCP vs UDP

| | TCP | UDP |
|---|---|---|
| Connection | Handshake required | Connectionless |
| Delivery | Guaranteed, ordered | Best effort |
| Retransmit | Yes | No |
| Speed | Slower (overhead) | Faster |
| Broadcast | No | Yes |
| Use for | HTTP(S), SMTP, FTP | Video, VoIP, DNS, gaming |

Rule: **use UDP when late data is worse than lost data.**

### DNS

Hierarchical name → IP resolution. Lookup path:

```
Client → Recursive Resolver → Root NS → TLD NS (.com) → Authoritative NS → IP
```

**Four server roles:**
- **Recursive resolver** — the middleman that does the legwork; serves from cache when it can.
- **Root nameserver** — 13 logical servers (many physical copies via Anycast), overseen by ICANN. Points to the right TLD.
- **TLD nameserver** — owns everything under `.com`, `.org`, `.uk`, etc. Managed by IANA.
- **Authoritative nameserver** — the final answer for a specific domain. Returns the A record, or a CNAME (which triggers a fresh lookup), or NXDOMAIN.

**Query types:** recursive (resolver does all the work), iterative (resolver returns a referral, client follows it), non-recursive (answer already cached/authoritative).

**Record types worth knowing:**

| Record | Holds |
|---|---|
| A | IPv4 address |
| AAAA | IPv6 address |
| CNAME | Alias to another domain (no IP) |
| MX | Mail server |
| TXT | Arbitrary text — used heavily for email auth (SPF/DKIM) and domain verification |
| NS | Nameserver for the zone |
| SOA | Zone admin metadata |
| SRV | Service + port |
| PTR | Reverse lookup (IP → name) |

**TTL** governs caching at every layer. Lower it *before* a planned migration, not during.

**Reverse DNS** (PTR) is mostly used by mail servers to reject likely-spam senders. Not required for the internet to function.

Managed options: Route 53, Cloudflare DNS, Google Cloud DNS, Azure DNS, NS1.

### 🆕 HTTP / HTTPS

Application-layer request/response protocol. **HTTPS is HTTP over TLS** — same semantics, encrypted transport.

**Version differences that affect design:**

| Version | Transport | Key change | Design impact |
|---|---|---|---|
| HTTP/1.0 | TCP | One request per connection | Brutal connection overhead |
| HTTP/1.1 | TCP | Keep-alive, pipelining, chunked encoding, `Host` header | Head-of-line blocking still present; browsers open ~6 connections per domain, which is why "domain sharding" was once a real technique |
| HTTP/2 | TCP | Binary framing, **multiplexing** many streams over one connection, header compression (HPACK), server push | Domain sharding becomes an anti-pattern; TCP-level head-of-line blocking remains |
| HTTP/3 | **QUIC over UDP** | Multiplexing without TCP head-of-line blocking, faster handshake, connection migration | Better on lossy/mobile networks; connections survive IP changes |

**Statelessness:** HTTP itself carries no session state. State comes from cookies, tokens, or server-side session stores — this is what makes horizontal scaling of web tiers straightforward.

**Caching headers worth knowing:** `Cache-Control` (max-age, no-store, private/public), `ETag` + `If-None-Match` (conditional requests → 304 Not Modified), `Last-Modified` + `If-Modified-Since`, `Vary`.

### 🆕 Checksums

A small fixed-size value computed from a data block, used to detect corruption in transit or at rest. Sender computes and transmits it; receiver recomputes and compares. Mismatch = corrupted data, discard and retransmit.

- **Where they already exist:** TCP segment checksums, Ethernet frame CRCs, IP header checksums.
- **Where you add your own:** distributed storage systems checksum blocks to detect **silent disk corruption (bit rot)** — HDFS, S3, and Cassandra all do this. Replication protocols use them to verify replicas match.
- **Checksum vs cryptographic hash:** CRC32 detects accidental corruption fast and cheap. SHA-256 additionally resists *deliberate* tampering. Use CRC for integrity, SHA for security.

Related: **content-addressable storage** uses the hash of content as its key, making dedup and integrity verification the same operation.

---

## 2. Traffic Management

### Load Balancing

Distributes traffic across healthy resources. Can and should exist at *every* tier, not just the edge.

**Distribution modes:** host-based (by hostname), path-based (by URL), content-based (inspects the body/params).

**Layers:**
- **L4 (network)** — routes on IP/port. Fast, often hardware, can't see content.
- **L7 (application)** — reads the whole request. Enables content routing, TLS termination, caching.

**Types:** software (Nginx, HAProxy — flexible, cheap), hardware (fast, expensive, rigid), DNS-based (**unreliable — DNS doesn't know about outages and will happily return dead IPs**).

**Routing algorithms:**

| Algorithm | Picks by | Best for | Watch out for |
|---|---|---|---|
| Round robin | Rotation | Homogeneous servers, uniform requests | Ignores actual load |
| Weighted round robin | Rotation, weighted by capacity | Mixed server sizes | Weights need manual tuning |
| Least connections | Fewest open connections | Long-lived or variable-duration requests | Connection count ≠ actual load |
| Least response time | Fastest response + fewest connections | Latency-sensitive traffic | Needs continuous measurement; can oscillate |
| Least bandwidth | Lowest Mbps served | Media/large-payload traffic | Narrow applicability |
| **IP hash** 🆕 | `hash(client IP) % N` | Session stickiness without shared session store | **Rebalances almost everything when N changes** — use consistent hashing instead |
| Hashing (general) | Hash of a chosen key (IP, URL) | Cache locality, stickiness | Same N-change problem |

*Working implementations of all of these: see §15.*

**The load balancer is itself a SPOF.** Run at least two in active-passive with failover detection.

**Features to look for:** autoscaling, sticky sessions, health checks, persistent connections (WebSockets), TLS termination, cert handling, compression, caching, logging, request tracing (request IDs!), redirects, fixed responses.

### Caching

> "There are only two hard things in Computer Science: cache invalidation and naming things." — Phil Karlton

Trades capacity for speed. Rests on **locality of reference**: recently requested data is likely to be requested again.

**Hit / miss:** a hit is served from cache. Hits are described as *hot* (L1, fastest), *warm* (L2/L3), or *cold* (deep in the hierarchy, still a hit). A miss falls through to the origin and typically populates the cache.

**🆕 Read strategies — who owns the fetch logic:**

| Strategy | Mechanism | Pro | Con |
|---|---|---|---|
| **Cache-aside (lazy loading)** | App checks cache; on miss, app reads DB and populates cache | Only requested data is cached; cache failure isn't fatal | Every miss costs 3 trips; risk of stale data; **cold start / thundering herd** on cache flush |
| **Read-through** | App only ever talks to the cache; the cache fetches from DB on miss | Simpler app code; consistent load pattern | Cache becomes a hard dependency; first request always slow |
| **Refresh-ahead** | Cache proactively refreshes hot entries before TTL expiry | Hides refresh latency from users | Wasted work if the prediction is wrong |

**Cache-aside is the default in practice.** Read-through is what you get "for free" from a caching library or a CDN.

**Write policies — the core tradeoff:**

| Policy | Mechanism | Pro | Con |
|---|---|---|---|
| **Write-through** | Write cache + DB simultaneously | Consistent, fast reads | Higher write latency; caches data that may never be read |
| **Write-around** | Write DB only, bypass cache | Lower write latency | Cache misses on recently-written data |
| **Write-back (write-behind)** | Write cache only, sync to DB async | Fastest writes, high throughput | Data loss if cache dies (mitigate with replicas) |

**🆕 Pairing them:** cache-aside + write-around is the common read-heavy combination. Read-through + write-through gives the strongest consistency at the cost of write latency. Write-back suits write-heavy workloads that can tolerate a loss window.

**🆕 Two failure modes to design around:**
- **Thundering herd / cache stampede** — a popular key expires and thousands of requests hit the DB simultaneously. Fix with request coalescing (one fetch, others wait), staggered/jittered TTLs, or probabilistic early expiry.
- **Cache penetration** — repeated requests for keys that don't exist bypass the cache every time. Fix by caching negative results with a short TTL, or with a **Bloom filter** in front (see §4).

**Eviction policies:** LRU (default choice), LFU, FIFO, LIFO, MRU, Random Replacement.

**Topologies:** *distributed cache* pools RAM across many machines into one logical store (scales past a single box). *Global cache* is one shared cache that all app nodes use and that fetches from the origin on a miss.

**When NOT to cache:**
- Cache access is as slow as the primary store.
- Requests have low repetition (high randomness) — no locality to exploit.
- Data changes constantly — you'll always be stale and always hitting origin anyway.

**A cache is never permanent storage.** It lives in volatile memory. Treat it as transient.

Tools: Redis, Memcached, ElastiCache, Aerospike.

### CDN

Geographically distributed edge servers caching static content (HTML/CSS/JS, images, video) close to users.

**How it works:** origin holds the canonical content; edge locations hold cached copies. First request to an edge populates it; subsequent requests are served locally. Reduces origin load, latency, and bandwidth cost.

| Type | Behavior | Best for |
|---|---|---|
| **Push** | You upload content to the CDN when it changes | Low traffic, infrequent updates — minimizes traffic, maximizes storage |
| **Pull** | CDN fetches from origin on first miss | High traffic — less maintenance, only hot content is cached |

**Downsides:** cost at high volume; some countries/orgs block CDN domains; if your audience is far from any PoP, you may add latency instead of removing it.

Tools: CloudFront, Cloud CDN, Cloudflare, Fastly.

### Proxies

- **Forward proxy** — sits in front of *clients*. Hides them from the origin. Used for content filtering, geo-unblocking, anonymity.
- **Reverse proxy** — sits in front of *servers*. Hides them from clients. Used for security, caching, TLS termination, load balancing, compression.

**Reverse proxy vs load balancer:** a reverse proxy is useful even with a single backend; a load balancer only makes sense with several. A reverse proxy can act as a load balancer; the reverse isn't true.

Tools: Nginx, HAProxy, Traefik, Envoy.

---

## 3. Availability & Scalability

### Availability

```
Availability = Uptime / (Uptime + Downtime)
```

**The nines:**

| Availability | Downtime/year | Downtime/month |
|---|---|---|
| 99% (two nines) | 3.65 days | 7.2 hours |
| 99.9% (three) | 8.77 hours | 43.8 min |
| 99.99% (four) | 52.6 min | 4.32 min |
| 99.999% (five) | 5.25 min | 25.9 sec |
| 99.9999% (six) | 31.6 sec | 2.59 sec |

**Composition — this is the part people get wrong:**

- **In sequence** (A depends on B): `A × B`. Two 99.9% components in series → **99.8%**. Availability *degrades* with each hop.
- **In parallel** (redundant): `1 − (1−A)(1−B)`. Two 99.9% components in parallel → **99.9999%**.

Practical implication: every synchronous dependency you add lowers your ceiling. Redundancy is the only thing that raises it.

**Availability ≠ reliability.** Reliable implies available; available doesn't imply reliable. **High availability ≠ fault tolerance:** HA accepts brief interruption at reasonable cost; fault tolerance accepts *zero* interruption via full redundancy, at much higher cost.

### 🆕 Single Point of Failure (SPOF)

Any component whose failure takes down the whole system. **Finding SPOFs is the single highest-value review activity in a design.**

Common ones people miss:
- The load balancer itself (run active-passive pairs)
- The primary database (replicas + automated failover)
- A single availability zone or region
- The service registry / config service
- The API gateway
- Shared caches that the app can't run without
- DNS with a single provider
- A CI/CD pipeline or secrets manager that blocks all recovery
- **A person** — one engineer who is the only one who can deploy

**Elimination toolkit:** redundancy (N+1 or N+2), replication, geographic distribution, graceful degradation (serve stale or reduced functionality rather than nothing), bulkheads (isolate resource pools so one exhausted pool doesn't starve the rest).

### 🆕 Failover

Automatic switching to a standby when the primary fails.

| Type | Mechanism | Recovery | Cost |
|---|---|---|---|
| **Cold standby** | Backup exists but isn't running | Slowest (minutes–hours) | Lowest |
| **Warm standby** | Standby running, data replicated, not serving | Minutes | Medium |
| **Hot standby / active-passive** | Standby fully synced, ready instantly | Seconds | Higher |
| **Active-active** | All nodes serving; failure just removes capacity | Near-zero | Highest |

**Failover mechanics:** health checks / heartbeats detect failure → a leader election or coordinator promotes the standby → traffic is redirected (DNS update, VIP move, or load balancer reconfiguration).

**The hard problem is split-brain** — a network partition makes both nodes believe the other is dead, and both accept writes. Prevention: **quorum** (require a majority to act), fencing tokens (monotonically increasing IDs so stale leaders are rejected), or STONITH. This is why odd numbers of nodes (3, 5, 7) are standard.

**Failback** is the return to the original primary once it recovers — often riskier than the failover itself, so many teams simply promote the standby permanently.

### 🆕 Latency vs Throughput vs Bandwidth

Constantly conflated; they measure different things.

| Term | Measures | Unit | Analogy (highway) |
|---|---|---|---|
| **Latency** | Time for one operation end-to-end | ms | How long one car takes to drive the route |
| **Throughput** | Operations completed per unit time | req/s, MB/s | Cars arriving per hour |
| **Bandwidth** | Maximum theoretical capacity | Mbps, Gbps | Number of lanes |

**The relationships that matter:**
- **Throughput ≤ bandwidth.** Bandwidth is the ceiling; throughput is what you actually achieve.
- **Low latency does not imply high throughput,** and vice versa. A system can serve one request in 1 ms but only handle 10 concurrent — low latency, low throughput.
- **Batching increases throughput and increases latency.** This tradeoff shows up everywhere: disk writes, network packets, database commits, ML inference.
- **Under load, latency degrades non-linearly.** As utilization approaches capacity, queueing theory says latency goes to infinity. This is why you target ~70% utilization, not 95%.

**Always ask which percentile.** Average latency hides everything. p50 is the typical experience; **p99 is the one that defines whether users think your system is broken.** With enough dependencies, nearly every request hits *someone's* p99 — this is tail latency amplification.

### Scalability

| | Vertical (scale up) | Horizontal (scale out) |
|---|---|---|
| Method | Bigger machine | More machines |
| Pros | Simple, easy to manage, consistent data | Redundancy, fault tolerance, flexible, easy upgrades |
| Cons | Downtime risk, hard ceiling, SPOF | Complexity, data consistency, downstream load |

Start vertical. Go horizontal when you hit the wall or need redundancy.

### Clustering

Two or more nodes working in parallel toward a shared goal, ideally appearing as a single system. Usually one leader node acts as entry point and delegates work.

**Types:** high-availability/failover, load balancing, high-performance computing.

**Configurations:**
- **Active-active** — all nodes serving. Goal is load distribution and throughput.
- **Active-passive** — one serving, one on standby. Goal is failover.

**Clustering vs load balancing:** nodes in a cluster *know about each other* and coordinate. Servers behind a load balancer don't — they just answer what they're given. Use both together.

**Challenges:** installing/updating OS + app + deps on every node; heterogeneous nodes make this worse; per-node resource monitoring; aggregated logging; shared storage must prevent conflicting writes; distributed stores must stay in sync.

Examples: Kubernetes, ECS, Cassandra, MongoDB, Redis cluster mode.

---

## 4. Storage & Databases

### Storage Types

**RAID levels:**

| Level | Description | Min disks | Fault tolerance | Capacity used |
|---|---|---|---|---|
| 0 | Striping | 2 | None | 100% |
| 1 | Mirroring | 2 | 1 drive | 50% |
| 5 | Striping + parity | 3 | 1 drive | 67–94% |
| 6 | Striping + double parity | 4 | 2 drives | 50–80% |
| 10 | Striping + mirroring | 4 | 1 per sub-array | 50% |

**Storage models:**

| Model | Data as | Access | Example |
|---|---|---|---|
| **File** | Hierarchical directories | Full path | EFS, Azure Files, Filestore |
| **Block** | Fixed-size blocks with IDs | Reassembled on request | EBS |
| **Object** | Objects + metadata in a flat namespace | Key/ID, HTTP API | S3, Blob Storage, GCS |

**NAS** — network-attached storage device, central location, incrementally expandable, on-prem control.

**HDFS** — distributed FS for commodity hardware. Stores files as sequences of equal-size blocks (except the last), replicated for fault tolerance. Built for high-throughput access to very large datasets.

### Databases & DBMS

A **database** is organized structured data; a **DBMS** is the software layer that mediates access, plus admin functions (monitoring, tuning, backup/recovery).

**Components:** schema (shape of the data — strict, loose, or absent), table, column (typed values), row (records).

**Scale challenges:** absorbing data volume growth; security vs accessibility; real-time access demands; management/staffing cost as complexity grows; scalability ceilings that are hard to predict; data residency/sovereignty/latency constraints that force on-prem.

### SQL (Relational)

Tables, columns, rows. Primary keys identify rows; foreign keys relate tables. Follows **ACID**.

**Materialized views** — pre-computed query results stored for reuse. Big win for frequent or expensive queries; also used for replication.

**N+1 query problem** — the data layer issues N extra queries to fetch data that one query could have retrieved. Endemic to ORMs and GraphQL resolvers. Fix with query optimization or a **dataloader** that batches consecutive requests into one.

**Pros:** simple, accurate, accessible, consistent, flexible querying.
**Cons:** expensive to maintain, painful schema evolution, join/denormalization performance hits, poor horizontal scalability.

Examples: PostgreSQL, MySQL, MariaDB, Aurora.

### NoSQL (Non-relational)

No SQL as primary access language, no required pre-defined schema. Follows **BASE**.

| Type | Model | Strengths | Weaknesses | Examples |
|---|---|---|---|---|
| **Document** | JSON-ish documents | Intuitive, flexible, easy horizontal scaling | Schemaless cuts both ways; non-relational | MongoDB, DocumentDB, CouchDB |
| **Key-value** | K→V pairs | Simple, fast, highly scalable, great for sessions/lookups | Basic CRUD only, can't filter on values, weak indexing | Redis, Memcached, DynamoDB, Aerospike |
| **Graph** | Nodes + edges + properties | Traversal speed, explicit relationships, agile | Complex, no standard query language | Neo4j, ArangoDB, Neptune, JanusGraph |
| **Time series** | Timestamped points | Fast insert/retrieve, efficient storage | Narrow purpose | InfluxDB, Druid |
| **Wide column** | Column families | Petabyte scale, real-time big data | Expensive, slower writes | Bigtable, Cassandra, ScyllaDB |
| **Multi-model** | Several models in one engine | Flexible, fits complex projects | Complex, less mature | ArangoDB, Cosmos DB, Couchbase |

Graph DB use cases: fraud detection, recommendations, social networks, network mapping.
Time series use cases: IoT, metrics, APM, financial trends.

### SQL vs NoSQL

| Dimension | SQL | NoSQL |
|---|---|---|
| Storage | Tables (rows = entities, columns = attributes) | Varies: KV, doc, graph, column |
| Schema | Fixed; changes need migrations | Dynamic; fields added on the fly |
| Querying | SQL — powerful, standard | Per-database syntax, collection-oriented |
| Scaling | Vertical (horizontal is hard) | Horizontal, often automatic |
| Reliability | ACID compliant | Usually trades ACID for scale |

**Pick SQL when:** structured data with a strict schema, relational data, complex joins, transactions, index lookups.
**Pick NoSQL when:** flexible schema, non-relational data, no joins needed, data-intensive workload, very high IOPS.

### Replication

**Master-slave (primary-replica):** primary handles reads+writes and replicates to replicas that serve reads only. Replicas can chain. If the primary dies, the system runs read-only until a replica is promoted.
- *Pros:* backups don't touch the primary; reads offloaded; replicas can go offline and resync without downtime.
- *Cons:* more hardware and complexity; downtime and possible data loss on primary failure; all writes still funnel to one node; more replicas → more replication lag.

**Master-master (multi-primary):** both nodes serve reads and writes and coordinate.
- *Pros:* read from either; write load distributed; fast automatic failover.
- *Cons:* harder to configure; either loosely consistent or slower writes due to sync; **conflict resolution becomes a real problem** as write nodes and latency increase.

**Synchronous** replication writes to primary and replica together (always in sync, higher latency). **Asynchronous** copies after the primary write completes — near-real-time or scheduled, cheaper, but a replication window where data can be lost.

### Indexes

A lookup structure that trades **storage overhead + slower writes** for **much faster reads**. Locates rows without a full table scan. Can be built on one or more columns.

| | Dense index | Sparse index |
|---|---|---|
| Entries | One per row | Only for some records |
| Write cost | Higher (every insert/update/delete maintains it) | Lower |
| Memory | More | Less |
| Lookup | Binary search, direct | Binary search + page scan |
| Data ordering | Not required | Works with ordered data |

### 🆕 Bloom Filters

A probabilistic set-membership structure. Answers "is X in the set?" with either **"definitely not"** or **"maybe."**

**Mechanism:** a bit array of size m plus k independent hash functions. To insert, hash the item k ways and set those k bits. To query, hash and check those k bits — if *any* is 0 the item is definitely absent; if *all* are 1 it's probably present.

**Properties:**
- **No false negatives, only false positives.** This asymmetry is the whole point.
- Extremely space-efficient — roughly 10 bits per element for ~1% false positive rate, regardless of element size.
- O(k) insert and query, independent of set size.
- **Cannot delete** (clearing bits would break other members). Counting Bloom filters or cuckoo filters solve this.
- False positive rate rises as the filter fills; size it for expected cardinality up front.

**Where they earn their keep:**
- **Avoiding disk reads** — Cassandra, HBase, and LevelDB check a Bloom filter before reading an SSTable from disk. A negative means skip the read entirely.
- **Cache penetration defense** — reject queries for keys that definitely don't exist before they reach the DB.
- **Deduplication** — "have I seen this URL?" in a web crawler.
- **CDN edge** — don't cache one-hit-wonder objects.

**Related structures worth knowing:** HyperLogLog (approximate distinct counts in tiny space — good for unique-visitor metrics), Count-Min Sketch (approximate frequency counts — good for heavy hitters and trending), Skip lists, Merkle trees (efficient replica comparison in Dynamo/Cassandra).

### 🆕 LSM Trees vs B-Trees

The storage-engine choice underneath your database, and it determines its performance shape.

| | B-Tree | LSM Tree |
|---|---|---|
| Writes | In-place update, random I/O | Append to in-memory memtable, flush sequentially |
| Write throughput | Lower | **Much higher** |
| Reads | Predictable, one traversal | May check memtable + several SSTables (Bloom filters mitigate) |
| Space | Fragmentation | Compaction reclaims, but needs headroom |
| Cost | Write amplification from page updates | Write amplification from compaction; compaction competes for I/O |
| Used by | PostgreSQL, MySQL/InnoDB | Cassandra, RocksDB, LevelDB, HBase, ScyllaDB |

Rule of thumb: **write-heavy → LSM; read-heavy with predictable latency → B-tree.**

### 🆕 Database Scaling Ladder

Apply in order. Each rung buys roughly an order of magnitude and costs complexity — don't skip.

1. **Optimize queries and add indexes.** Most "we need to shard" conversations end here. Profile first.
2. **Connection pooling.** Connections are expensive; pool them (PgBouncer et al.).
3. **Vertical scaling.** More CPU/RAM/IOPS. Boring and effective.
4. **Read replicas.** Offload reads. Accept replication lag — and design for read-your-own-writes where it matters (route the user's reads to the primary briefly after a write).
5. **Caching layer.** Redis/Memcached in front. Usually the biggest single win.
6. **Denormalization + materialized views.** Trade write cost for read speed.
7. **Federation** (split by function) — often easier than sharding and gets you far.
8. **Sharding** (split by rows). Last resort. Once sharded, cross-shard joins and transactions become your permanent problem.

### Normalization & Denormalization

**Keys:** primary (uniquely identifies a row), composite (multi-column primary), super (any set that uniquely identifies), candidate (attributes that uniquely identify), foreign (reference to another table's primary), alternate (non-primary candidate), surrogate (system-generated ID when nothing natural works).

**Dependencies:** partial (primary key determines some other attributes), functional (relationship between two attributes), transitive (a non-key attribute determines another attribute).

**Anomalies** — the reason normalization exists:
- **Insertion** — can't add a record because other attributes are missing (new hire with no team yet).
- **Update** — redundant data means one logical change requires many row updates; miss one and you're inconsistent.
- **Deletion** — removing one fact forces removal of unrelated facts.

**Normal forms:**
- **1NF** — no repeating groups; primary key identifies each set; related data gets its own table; no mixed types in a column.
- **2NF** — 1NF + no partial dependencies.
- **3NF** — 2NF + no transitive functional dependencies.
- **BCNF (3.5NF)** — 3NF + for every functional dependency X→Y, X is a super key.

A relation is generally called "normalized" at 3NF, which eliminates most insert/update/delete anomalies. (4NF, 5NF, 6NF exist and rarely matter in practice.)

*Normalization:* less redundancy, better design, consistency, referential integrity — at the cost of complexity, slower reads, maintenance, and more joins.

*Denormalization:* deliberately adding redundant data to avoid expensive joins. Faster reads and simpler queries at the cost of expensive writes, more redundancy, and more inconsistency risk. **Especially valuable once data is sharded or federated**, since cross-network joins are brutal. Note: denormalization is not "undoing" normalization — it's a deliberate optimization on top of a normalized design.

---

## 5. Consistency & Transactions

### ACID vs BASE

**ACID** (relational default):
- **Atomic** — all operations succeed or all roll back.
- **Consistent** — the database is structurally sound after the transaction.
- **Isolated** — concurrent transactions appear to run sequentially.
- **Durable** — committed writes survive system failure.

**BASE** (NoSQL default):
- **Basically Available** — the system responds most of the time.
- **Soft state** — stores need not be write-consistent; replicas need not agree at all times.
- **Eventual consistency** — data converges eventually; reads may return stale values in the meantime.

Neither is "better." BASE demands more rigor from developers because the database won't catch your mistakes. ACID's simplicity is genuinely valuable where correctness matters (money, inventory, identity).

### CAP Theorem

A distributed system can guarantee only two of: **Consistency** (every read sees the latest write, regardless of node), **Availability** (every request gets a response even with nodes down), **Partition tolerance** (system keeps working despite message loss or network split).

**In practice, P is not optional** — networks partition. So the real choice is C vs A:

| Class | Behavior on partition | Examples |
|---|---|---|
| **CA** | Can't tolerate partitions at all | PostgreSQL, MariaDB (single-node semantics) |
| **CP** | Shuts down inconsistent nodes until resolved | MongoDB, HBase |
| **AP** | Stays up, may serve stale data, reconciles after | Cassandra, CouchDB |

### PACELC Theorem

Extends CAP with latency. Reads: **if Partition, choose A or C; Else, choose L (latency) or C.**

This matters because CAP has no notion of performance — under CAP, a database that answers in 30 days is technically "available." PACELC forces you to acknowledge that even in steady state, stronger consistency costs latency. (Described by Daniel Abadi.)

### Transactions

A series of operations treated as a single unit of work — all succeed or all fail.

**States:** Active → Partially Committed → Committed → Terminated. On failure: Active → Failed → Aborted (recovery manager rolls back writes), then either restart or kill the transaction.

### Distributed Transactions

Operations spanning two or more databases. All nodes must commit, or all must abort.

**Two-Phase Commit (2PC)**
1. **Prepare** — coordinator asks every participant if it can commit. Any "no" → abort.
2. **Commit** — if all prepared, coordinator tells everyone to commit.

*Problems:* participant crash; **coordinator crash** (worst case); and it is a **blocking protocol** — participants wait indefinitely.

**Three-Phase Commit (3PC)**
Splits commit into Prepare → **Pre-commit** → Commit. The pre-commit phase guarantees that if any participant is in it, *every* participant completed prepare — and it gives every phase a timeout, eliminating indefinite waits.

**Sagas**
A sequence of local transactions. Each updates its own DB and emits an event triggering the next. If one violates a business rule, the saga runs **compensating transactions** to undo prior steps.

- **Choreography** — each service publishes events that trigger others. Decentralized, no coordinator.
- **Orchestration** — a central orchestrator tells participants what to run. Easier to reason about, but a coordination point.

*Problems:* very hard to debug; risk of cyclic dependencies between participants; **no isolation between participants** creates durability challenges; testing requires all services running.

> **Practical note:** for most microservice systems, sagas are the realistic option. 2PC across services is usually a sign you drew your service boundaries wrong.

### 🆕 Consensus Algorithms

Getting a set of nodes to agree on a value despite failures. This is the foundation under leader election, distributed locks, config stores, and replicated state machines.

**Why it's hard:** the FLP impossibility result proves no deterministic algorithm can guarantee consensus in a fully asynchronous system with even one faulty node. Real algorithms sidestep this with timeouts and randomization — they guarantee **safety always, liveness eventually.**

| Algorithm | Notes |
|---|---|
| **Paxos** | Lamport's original. Provably correct, notoriously hard to understand and implement correctly. Roles: proposers, acceptors, learners. Multi-Paxos amortizes cost across a sequence of decisions. |
| **Raft** | Designed explicitly for understandability, and now the default choice. Decomposes into leader election, log replication, and safety. Used by etcd, Consul, CockroachDB, TiKV. |
| **Zab** | ZooKeeper's atomic broadcast protocol. Similar guarantees, primary-backup oriented. |
| **PBFT / BFT variants** | Tolerate *malicious* nodes, not just crashed ones. Needed for blockchains; overkill inside a trusted datacenter. |

**The quorum rule:** to tolerate f failures you need **2f + 1** nodes (crash faults). 3 nodes tolerate 1 failure; 5 tolerate 2. This is why cluster sizes are odd.

**Read/write quorums:** with N replicas, if **W + R > N** you're guaranteed to read at least one node with the latest write. Dynamo-style systems expose N, W, and R as tunable knobs — that's how you dial between consistency and latency per-operation.

**Practical advice: do not implement consensus yourself.** Use etcd, ZooKeeper, or Consul. The failure modes are subtle and the correct implementations took years.

### 🆕 Distributed Locking

Mutual exclusion across machines. Two very different reasons to want one:

- **Efficiency** — avoid doing the same work twice (e.g., don't send the same email twice). A rare lock failure costs money, not correctness.
- **Correctness** — prevent data corruption. A lock failure is unacceptable.

**Be honest about which you need.** For efficiency, a simple Redis lock is fine. For correctness, it likely isn't.

**Implementations:**
- **Redis single-instance** (`SET key value NX PX ttl`) — fast, simple, and **not safe for correctness**: if the lock holder pauses (GC, page fault) past the TTL, a second holder acquires it while the first still thinks it holds it.
- **Redlock** (multi-instance Redis) — acquire on a majority of independent nodes. Its safety under clock drift and process pauses is [genuinely disputed](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html); Kleppmann's critique is required reading before you rely on it.
- **ZooKeeper / etcd** — ephemeral sequential nodes or leases with a consensus protocol underneath. Slower, and the right answer when correctness matters.

**Fencing tokens are the actual fix.** Each lock grant returns a monotonically increasing token; the protected resource rejects any write carrying a token lower than the highest it has seen. This makes a stale lock holder harmless regardless of pauses or clock skew. **If your storage layer can't check a fencing token, a distributed lock cannot give you correctness — full stop.**

**Alternatives that avoid locking entirely:** partition the work so only one owner exists per key; use optimistic concurrency (compare-and-swap / version columns); make operations idempotent so duplicates don't matter; use single-writer-per-shard designs.

---

## 6. Distributing Data

### Partitioning & Sharding

**Horizontal partitioning (= sharding)** splits rows across machines by a partition key. **Vertical partitioning** splits columns into narrower tables.

**Sharding:** each shard has the same schema but a unique, independent subset of rows. Justification: past a certain point, adding commodity machines beats buying a bigger one. Can be done at the application or database layer.

**Partitioning criteria:**

| Criterion | How | Watch out for |
|---|---|---|
| **Hash-based** | Hash the key, mod by shard count | Adding/removing nodes is expensive (see consistent hashing) |
| **List-based** | Explicit list of values per partition | Manual maintenance |
| **Range-based** | Contiguous, non-overlapping ranges | Hotspots if the key correlates with time or popularity |
| **Composite** | Partition by one method, sub-partition by another | Complexity |

*Advantages:* availability (independent partitions), scalability, security (isolate sensitive data), query performance (smaller working set), manageability.

*Disadvantages:* general complexity; **cross-shard joins** are often infeasible and always slow; **rebalancing** when distribution or load is uneven.

**Shard when:** you want commodity hardware over high-end machines; you need data in specific geographies; you need to add capacity quickly; per-machine load must drop; you need more concurrent connections.

### Consistent Hashing

**The problem:** naive `hash(key) % N` breaks completely when N changes — nearly every key remaps to a different node, forcing mass redistribution.

**The solution:** map both keys and nodes onto an abstract ring (hash range `0…m−1`). A key is served by the first node clockwise from its position. Adding or removing a node only affects keys between it and its neighbor.

```
R = K / N
```
Where R = data requiring redistribution, K = number of keys, N = number of nodes.

**Virtual nodes (VNodes):** in practice a plain ring distributes unevenly and creates hotspots. Instead of one position per physical node, assign each physical node many small ranges scattered around the ring (via k hash functions). This smooths distribution, speeds up rebalancing, and reduces hotspot probability.

**Data replication:** each item is replicated to N nodes, where N is the **replication factor**. In eventually consistent systems this happens asynchronously.

*Advantages:* predictable scaling, natural partitioning + replication, fewer hotspots.
*Disadvantages:* complexity; cascading failures; distribution can still be uneven; key management gets expensive when nodes fail transiently.

Used by: Cassandra (data partitioning), DynamoDB (load distribution across storage hosts).

### Database Federation

Splits databases **by function** (functional partitioning) — e.g., separate DBs for users, products, and forums — presented to clients as one logical database via federated schemas.

**Characteristics:** transparency (users don't know where data lives), heterogeneity (different hardware, protocols, data models), extensibility (easy to add sources), autonomy (doesn't modify existing sources), data integration (unified view across protocols and DBMSs).

*Pros:* flexible sharing, component autonomy, unified access to heterogeneous data, no tight coupling to legacy DBs.
*Cons:* more hardware and complexity, cross-database joins are hard, dependence on autonomous sources, query performance and scalability limits.

---

## 7. Architecture Patterns

### 🆕 Client-Server Architecture

The base model almost everything else builds on. Clients request; a server holds resources and responds. Servers are always-on and centrally managed; clients are many, intermittent, and untrusted.

**Why it dominates:** centralized control of data and security, easier to back up and update, clients stay thin.
**What it costs:** the server is a bottleneck and a SPOF; scaling costs money; clients are useless when the server is unreachable.

**Never trust the client.** All authorization, validation, and business rules must be enforced server-side — the client is a convenience, not a security boundary.

### 🆕 Serverless Architecture

You deploy functions or containers; the platform handles provisioning, scaling, and capacity. "Serverless" means *you* don't manage servers, not that none exist.

**Model:** event-driven and ephemeral. Functions spin up on a trigger (HTTP, queue message, file upload, schedule), run, and are torn down. Billing is per-invocation and per-millisecond.

*Advantages:* no server management; automatic and effectively unlimited scaling; **pay only for actual execution** (nothing at idle); fast to ship; built-in availability.

*Disadvantages:*
- **Cold starts** — the first invocation after idle adds latency (tens of ms to seconds depending on runtime). Mitigate with provisioned concurrency or lighter runtimes.
- **Execution time limits** (typically ~15 min) — long jobs don't fit.
- **Stateless by force** — all state must live externally, which means more network round trips.
- **Vendor lock-in** — the event model and tooling are provider-specific.
- **Cost inversion at scale** — cheap when traffic is spiky or low, often *more* expensive than reserved instances at steady high volume.
- **Harder local testing, debugging, and tracing.**
- **Database connection exhaustion** — thousands of concurrent functions each opening a connection will kill a relational DB. Use a connection proxy (RDS Proxy) or a serverless-friendly datastore.

**Good fits:** spiky or unpredictable traffic, event processing and glue code, scheduled jobs, webhook receivers, image/file processing, low-traffic APIs, prototypes.
**Bad fits:** sustained high-throughput services, long-running computation, latency-critical paths where cold starts are unacceptable, workloads needing persistent connections.

Platforms: AWS Lambda, Cloud Functions, Azure Functions, Cloudflare Workers, Vercel/Netlify Functions, Fargate/Cloud Run (serverless containers).

### 🆕 Peer-to-Peer (P2P) Architecture

No central server — every node is both client and server, sharing resources directly with peers.

**Types:**
- **Unstructured** — random connections, flooding-based search. Robust to churn, but search is inefficient and may fail to find rare content (early Gnutella).
- **Structured (DHT)** — nodes organized by a distributed hash table (Chord, Kademlia, Pastry) giving O(log n) lookup. Efficient, but higher maintenance under churn.
- **Hybrid** — a central tracker or index for discovery, direct peer transfer for data (BitTorrent). Pragmatic and by far the most common in practice.

*Advantages:* no SPOF, **capacity grows as users join** rather than degrading, no central infrastructure cost, censorship resistance.
*Disadvantages:* security and trust (peers are untrusted, content can be poisoned), consistency is hard, NAT traversal is genuinely painful (hence STUN/TURN/ICE), free-rider problem, unpredictable performance from heterogeneous peers, legal and moderation complexity.

**Where it shows up in real systems:** BitTorrent and IPFS; blockchain networks; WebRTC for video/voice (peer media, central signaling); Spotify's original client (later dropped for CDN); Netflix Open Connect is *not* P2P — it's ISP-embedded CDN, a common confusion.

**The recurring pattern is hybrid**: centralize coordination and discovery (which is small and needs consistency), decentralize bulk data transfer (which is large and doesn't).

### N-Tier Architecture

Splits an app into logical **layers** (separation of responsibility) and physical **tiers** (separate machines). Higher layers use lower layers, never the reverse.

- **Closed layering** — a layer may only call the layer directly below. Limits dependencies but can create pass-through traffic.
- **Open layering** — a layer may call any layer below it.

**3-tier** (the common one): Presentation → Business Logic → Data Access.
**2-tier:** client presentation talks straight to a data store, no business layer.
**1-tier:** everything on one machine.

*Pros:* availability, security (layers act as firewalls), independent scaling per tier, maintenance ownership.
*Cons:* complexity, added network latency per tier, hardware cost per tier, network security management.

### Message Brokers

Software that lets applications communicate by translating between messaging protocols. Validates, stores, routes, and delivers messages. Senders don't need to know who's receiving, whether they're up, or how many there are.

**Two distribution models:** point-to-point (message queues, 1:1) and publish-subscribe (topics, 1:many).

**Broker vs event streaming platform:** brokers support both models and guarantee delivery/track consumers. Streaming platforms only do pub/sub, but scale better and retain ordered topic records for a set period. Streaming platforms **cannot guarantee delivery or track which consumers received what**, and offer weaker routing/queueing.

**Broker vs ESB:** brokers are the lightweight alternative — similar function, lower cost, better fit for microservices.

Tools: NATS, Kafka, RabbitMQ, ActiveMQ.

### Message Queues

Asynchronous service-to-service communication. Messages persist until processed and deleted. **Each message is processed exactly once by a single consumer.**

Flow: producer publishes a job → notifies user of status → consumer picks it up, processes, signals completion.

*Advantages:* scalability (scale exactly where needed), decoupling, performance (producers don't wait), reliability (persistence survives component outages).

**Features:**

| Feature | Meaning |
|---|---|
| Push vs pull | Pull = poll for messages; push = notified on availability. Long polling splits the difference |
| FIFO | Oldest message first |
| Delay delivery | Schedule a message for later; delay queues for a global delay |
| At-least-once | Redundant copies + resend on failure — **expect duplicates** |
| Exactly-once | FIFO queues dedupe automatically |
| Dead-letter queue | Holds unprocessable messages for inspection without blocking the main queue |
| Ordering | Usually best-effort, not guaranteed |
| Poison pill | Special message signaling a consumer to shut down |
| Security | Authentication + encryption in transit and at rest |
| Task queues | Receive task + data, run it, deliver results; supports scheduling and heavy background jobs |

**Backpressure:** if queues grow past memory, you get cache misses, disk reads, and degradation. Cap queue size — return 503 when full and let clients retry with **exponential backoff**. Better to shed load than to melt down.

Tools: SQS, RabbitMQ, ActiveMQ, ZeroMQ.

### Publish-Subscribe

Any message published to a topic is pushed immediately to **all** subscribers, each of which may do something different with it in parallel. Publishers don't know subscribers; subscribers don't know publishers.

Unlike queues (which batch until retrieved), topics push out with little or no queuing.

*Advantages:* eliminates polling (lower latency); dynamic targeting (subscribers come and go, system adjusts); decoupled independent scaling; simplified topology (one connection to a topic replaces N point-to-point links).

*Features:* push delivery, multiple delivery protocols (queues, serverless functions, HTTP endpoints), **fanout** (one message replicated to many endpoints for parallel processing), filtering (subscribers get only what they want), durability (copies on multiple servers, at-least-once), security.

Tools: SNS, Google Pub/Sub.

### 🆕 Change Data Capture (CDC)

Captures row-level changes in a database and streams them as events. **The bridge between "we have a database" and "we have an event-driven system"** — without requiring the application to publish events itself.

**Approaches:**

| Approach | Mechanism | Verdict |
|---|---|---|
| **Log-based** | Tail the DB's write-ahead log (Postgres WAL, MySQL binlog, Mongo oplog) | **The right answer.** No app changes, no schema changes, captures deletes, minimal load, preserves ordering |
| Trigger-based | DB triggers write to an audit table | Captures everything but adds write latency and operational burden |
| Query-based (polling) | Poll `WHERE updated_at > last_check` | Simple but misses deletes, misses intermediate states, adds load, needs a reliable timestamp column |

**Why it matters:** it solves the **dual-write problem**. If your app writes to the DB and then publishes to Kafka, those two operations aren't atomic — a crash between them leaves the system inconsistent. CDC derives events *from* the committed database log, so the event is guaranteed to reflect committed state.

**The transactional outbox pattern** achieves the same thing deliberately: write the business change and an outbox row in one local transaction, then have CDC (or a poller) publish from the outbox. This is the standard fix and pairs naturally with sagas.

**Use cases:** keeping search indexes (Elasticsearch) in sync; cache invalidation driven by actual data changes; replicating to a data warehouse / analytics store; materializing CQRS read models; microservice data synchronization; audit trails; zero-downtime migrations (dual-write via CDC, then cut over).

**Watch out for:** schema evolution breaking downstream consumers (use a schema registry); initial snapshot/backfill before streaming; consumers must be idempotent since delivery is at-least-once; CDC exposes your internal schema, which couples consumers to it.

Tools: **Debezium** (the de facto standard, Kafka Connect-based), Maxwell, AWS DMS, Kafka Connect.

### Enterprise Service Bus (ESB)

Centralized component performing integrations: data model transformation, connectivity, routing, protocol conversion, request composition — exposed as reusable service interfaces.

*Theory:* standardize and simplify all enterprise communication. Improved developer productivity, independent component scaling, resilience.

*Reality — why ESBs fell out of favor:* changes to one integration destabilize others; **single point of failure for all communication**; updates require massive regression testing; central management makes cross-team collaboration hard; high configuration and maintenance complexity.

Tools: Azure Service Bus, IBM App Connect, Apache Camel, Fuse ESB.

### Monoliths vs Microservices

**Monolith:** self-contained, single deployable unit that handles every step of a business need.
- *Pros:* simple to develop and debug, fast in-process communication, easy monitoring and testing, ACID transactions work naturally.
- *Cons:* maintenance degrades as the codebase grows, tightly coupled, locked into one stack, full redeploy on every change, one bug can take everything down, hard to scale selectively.

**Modular monolith:** single deployable, but internally split into independent modules per feature. Reduces inter-module dependencies so you can change one without touching others. **Often the right answer** — most of the maintainability benefit, none of the distributed-systems tax.

**Microservices:** collection of small autonomous services, each implementing a single business capability within a **bounded context**. Separate codebases, independent deployment, **database per service**.

*Characteristics:* loosely coupled; small but focused (scope, not size — "does one thing well"); built around business capabilities; resilient and fault-tolerant; highly maintainable and testable.

*Pros:* independent deploy and scale, team agility, fault isolation, data isolation, no long-term stack commitment.
*Cons:* distributed-system complexity, harder testing, expensive to run, inter-service communication problems, data integrity and consistency, network congestion and latency.

**Best practices:**
- Model services around the business domain.
- Loose coupling, high functional cohesion.
- Isolate failures; use resiliency strategies to stop cascades.
- Communicate only through well-designed APIs — don't leak implementation details.
- Data storage is private to its owning service.
- Avoid coupling: no shared DB schemas, no rigid protocols.
- Decentralize everything — teams own their services, don't share code or schemas.
- Fail fast with circuit breakers.
- Keep API changes backward compatible.

**Pitfalls:** boundaries not based on the business domain; underestimating distributed-system difficulty; shared databases or common dependencies; lack of business alignment; unclear ownership; **lack of idempotency**; forcing ACID where BASE belongs; no fault-tolerance design → cascading failures.

**The distributed monolith** — microservices in name only. You have one if: services need low-latency communication, services don't scale independently, services depend on each other, they share resources like databases, or they're tightly coupled. This is the worst of both worlds: monolith coupling *plus* network failure modes.

**Microservices vs SOA:** the difference is scope. SOA makes components reusable via service interfaces using common standards, maximizing reuse. Microservices are the smallest independent units, optimizing for team autonomy and decoupling.

**Why you probably don't need microservices:**
> Microservices solve an **organizational** problem, not a technical one.

Start with a monolith. Before migrating, ask honestly:
- Is the team too large to work effectively on a shared codebase?
- Are teams blocked on other teams?
- Does this deliver clear business value?
- Is the business mature enough?
- Is the current architecture limiting us through communication overhead?

We take inspiration from Netflix while forgetting that we are not Netflix — they iterated through many models before microservices solved a problem they had actually identified. If the business doesn't have complex problems, it doesn't need complex solutions.

### Event-Driven Architecture (EDA)

Using events to communicate within a system, typically via a message broker, publishing and consuming asynchronously. Publishers don't know consumers; consumers don't know each other. **EDA is a means to loose coupling.**

**An event** is a data point representing a state change. It notifies that something happened — it does *not* specify what should happen next or how the system should change.

**Components:** event producers (publish to the router) → event routers (filter and push) → event consumers (react).

**Implementation patterns:** sagas, publish-subscribe, event sourcing, CQRS.

*Advantages:* decoupled producers/consumers, highly scalable and distributed, trivial to add new consumers, improves agility.
*Challenges:* guaranteed delivery, difficult error handling, general complexity, exactly-once and in-order processing.

*Use cases:* metadata and metrics, server and security logs, integrating heterogeneous systems, fanout and parallel processing.

Tools: NATS, Kafka, EventBridge, SNS, Google Pub/Sub.

### Event Sourcing

Instead of storing current state, store the **full append-only series of actions** taken on the data. The event store is the system of record; domain objects are materialized from it.

**Event sourcing ≠ EDA.** EDA is about using events to *communicate across service boundaries*. Event sourcing is about using events as *state* — a different way of storing data. Event sourcing is one of several ways to implement an EDA.

*Advantages:* excellent for real-time reporting; fail-safe (state can be reconstituted from the event store); extremely flexible (any message type); the preferred way to get audit logs in high-compliance systems.
*Disadvantages:* demands very efficient network infrastructure; needs reliable message-format control (schema registry); events carry heterogeneous payloads.

### CQRS

Command Query Responsibility Segregation (described by Greg Young) divides system actions into:
- **Commands** — instructions to change something. Return success/failure, not data.
- **Queries** — requests for information. No state change, no side effects.

Separating them lets each be optimized independently — a large win for distributed systems.

**With event sourcing:** the event store is the write model and the source of truth; the read model provides materialized, typically **highly denormalized** views. Read and write models often live in physically separate stores.

*Advantages:* independent scaling of read and write workloads; easier optimization and architectural change; closer to business logic with loose coupling; avoids complex joins on read; clear behavioral boundaries.
*Disadvantages:* more complex design; message failures and duplicates; eventual consistency is a real challenge; higher maintenance effort.

*Use when:* read and write performance must be tuned separately; the model will evolve or has multiple versions; business rules change often; integrating with other systems (especially with event sourcing) where one subsystem's failure shouldn't affect others; you need tighter control over which entities can write.

### API Gateway

Single entry point between clients and backend services. Encapsulates internal architecture and exposes a per-client-tailored API.

**Why:** microservices expose fine-grained APIs; clients need coarse-grained ones. Without a gateway, every client talks to many services directly.

**Features:** authentication/authorization, service discovery, reverse proxy, caching, security, retry + circuit breaking, load balancing, logging and tracing, API composition, rate limiting and throttling, versioning, routing, IP allow/deny lists.

*Pros:* encapsulates internal structure, centralized API view, simpler client code, built-in monitoring/analytics/tracing.
*Cons:* potential SPOF, performance impact, becomes a bottleneck if not scaled, configuration complexity.

**Backend For Frontend (BFF)** — separate backend services per frontend (described by Sam Newman). Use when a general-purpose backend carries heavy customization overhead for multiple interfaces, or when you want to optimize the backend for one client's needs. Moves reformatting logic out of the frontend into an intermediate layer. **GraphQL works very well as a BFF.**

Tools: Amazon API Gateway, Apigee, Azure API Management, Kong.

---

## 8. Communication & APIs

### REST

Architectural style introduced by Roy Fielding (2000). **The fundamental unit is a resource.**

**Constraints:** uniform interface, client-server, stateless (no client context stored between requests), cacheable (responses declare cacheability), layered system, code on demand (*optional*).

**HTTP verbs:** GET (retrieve), HEAD (GET without body), POST (submit, causes state change), PUT (replace entire resource), DELETE (remove), PATCH (partial modification).

**Response code classes:** 1xx informational, 2xx success, 3xx redirection, 4xx client error, 5xx server error.

**Canonical resource design:**

| URI | Verb | Action |
|---|---|---|
| `/users` | GET | List users |
| `/users/{id}` | GET | Get one user |
| `/users` | POST | Create user |
| `/users/{id}` | PATCH | Update user |
| `/users/{id}` | DELETE | Delete user |

*Pros:* simple, flexible, portable, excellent caching, decoupled client/server.
*Cons:* over-fetching, multiple round trips for related data.

Worth reading further on: HATEOAS.

### GraphQL

Query language + server runtime giving clients exactly the data they ask for. Built at Facebook, open-sourced 2015. **The fundamental unit is a query.**

**Concepts:** schema (describes available functionality), queries (fields + arguments; mutations modify server data), resolvers (functions that handle each part of a query).

```graphql
type Query { getUser: User }
type User { id: ID  name: String  city: String  state: String }
```
```graphql
{ getUser { id name city } }
```

*Pros:* eliminates over-fetching, strongly typed schema, code generation, payload optimization. Maintainers can add or deprecate fields without breaking existing queries.
*Cons:* shifts complexity server-side, **caching is hard**, versioning is ambiguous, N+1 problem.

*Use for:* reducing bandwidth (multiple resources in one query), rapid prototyping of complex systems, graph-like data models.

### gRPC

High-performance RPC framework. Define a service and its methods with typed params and returns.

**Concepts:** protocol buffers (language/platform-neutral serialization — like JSON but smaller, faster, with generated native bindings); service definition using protobuf as the IDL for both interface and payload.

```protobuf
service HelloService {
  rpc SayHello (HelloRequest) returns (HelloResponse);
}
message HelloRequest  { string greeting = 1; }
message HelloResponse { string reply = 1; }
```

*Pros:* lightweight and efficient, high performance, built-in codegen, bi-directional streaming.
*Cons:* newer, limited browser support, steeper learning curve, not human readable.

*Use for:* real-time bi-directional streaming, inter-service communication in microservices, low-latency/high-throughput paths, polyglot environments.

### Comparison

| | Coupling | Chattiness | Performance | Complexity | Caching | Codegen | Discoverability | Versioning |
|---|---|---|---|---|---|---|---|---|
| **REST** | Low | High | Good | Medium | Great | Bad | Good | Easy |
| **GraphQL** | Medium | Low | Good | High | Custom | Good | Good | Custom |
| **gRPC** | High | Medium | Great | Low | Custom | Great | Bad | Hard |

**Which is better?** None. Users only care that your API is consistent. Pick based on domain and requirements.

### Real-Time: Long Polling vs WebSockets vs SSE

The web began request/response — the server had no way to push. Three workarounds:

**Long polling** — server holds the request open, responding only when data is available or timeout hits; client immediately reopens.
- *Pros:* easy to implement, near-universal support, fine for small scale.
- *Cons:* **not scalable** — new connection each cycle is server-intensive; message ordering issues across multiple requests; latency waiting for the next request.

**WebSockets** — full-duplex over a single persistent TCP connection. Client sends an HTTP Upgrade header; on successful handshake the connection switches to `ws://` and both sides can send at any time.
- *Pros:* full-duplex async messaging, better origin-based security model, lightweight on both ends.
- *Cons:* terminated connections don't auto-recover (you must implement reconnect); older browsers lack support.

**Server-Sent Events (SSE)** — server pushes to client over a long-lived connection. **Unidirectional** — once the client sends the request, it can only receive.
- *Pros:* simple on both ends, broadly supported, firewall-friendly.
- *Cons:* unidirectional; limits on max open connections; **no binary data**.

**Choosing:** need bidirectional (chat, collaborative editing, live location)? → WebSockets. Server-to-client only (notifications, live scores, progress)? → SSE. Small scale, need it working today? → long polling.

### 🆕 Webhooks

A **reversed API call**: instead of you polling a provider for changes, the provider POSTs to a URL you register when an event occurs. Sometimes called a "reverse API" or HTTP callback.

**Webhooks vs polling:**

| | Polling | Webhooks |
|---|---|---|
| Latency | Bounded by poll interval | Near-immediate |
| Efficiency | Wasteful — most polls return nothing | Only fires on real events |
| Requirement | Just outbound HTTP | You must expose a public endpoint |
| Reliability | You control retries | You depend on the sender's retry policy |
| Ordering | You control it | Usually **not guaranteed** |

**Consuming webhooks correctly — the checklist:**
1. **Verify the signature.** Providers sign the payload with a shared secret (usually HMAC-SHA256 in a header). Verify before doing anything else, or anyone can forge events.
2. **Respond 2xx immediately, process asynchronously.** Acknowledge within a couple of seconds and push the work to a queue. Slow handlers cause the sender to time out and retry, multiplying your load.
3. **Be idempotent.** Retries mean you *will* receive duplicates. Deduplicate on the provider's event ID.
4. **Tolerate out-of-order delivery.** Use event timestamps or version numbers; don't assume sequence.
5. **Handle replay attacks** — reject events with old timestamps.
6. **Have a reconciliation path.** Webhooks get dropped. Periodically poll the provider's API to catch anything missed. Belt and braces.

**Producing webhooks:** retry with exponential backoff, cap attempts, expose a dead-letter view and manual replay, let consumers rotate secrets, and document your delivery guarantees honestly (almost always at-least-once, unordered).

### 🆕 Idempotency

An operation is idempotent if performing it multiple times has the same effect as performing it once. **In any distributed system this is not optional** — networks time out, clients retry, queues deliver at-least-once, and load balancers re-route. Without idempotency, every retry is a potential duplicate charge, duplicate order, or duplicate message.

**HTTP verbs by nature:**

| Verb | Idempotent? | Safe? |
|---|---|---|
| GET, HEAD | Yes | Yes |
| PUT | Yes (full replacement) | No |
| DELETE | Yes (second delete is a no-op) | No |
| **POST** | **No** | No |
| PATCH | Depends on the patch semantics | No |

**Implementation patterns:**
- **Idempotency keys** — the client generates a unique key (UUID) per logical operation and sends it in a header. The server stores key → result. A repeat key returns the stored result without re-executing. This is how Stripe's API works, and it's the standard for payments.
- **Natural idempotency** — design the operation so repetition is harmless: `SET balance = 100` rather than `balance = balance + 10`.
- **Deduplication table** — record processed message/event IDs and skip repeats. Needs a retention policy.
- **Conditional writes / optimistic concurrency** — compare-and-swap on a version number; the second attempt fails the version check.
- **Upserts** — `INSERT ... ON CONFLICT DO NOTHING` with a unique constraint on a business key.

**Gotchas:** the key must cover the whole operation including side effects, not just the DB write. Storing the key and doing the work must be atomic, or a crash between them breaks the guarantee. And decide the retention window — keys can't be kept forever.

### 🆕 REST vs RPC

Different mental models, not just different syntax.

| | REST | RPC |
|---|---|---|
| Model | **Resources** and their state | **Actions** / procedures |
| Naming | Nouns + HTTP verbs (`POST /orders`) | Verbs (`createOrder()`) |
| Coupling | Loose | Tighter — client knows the procedure signature |
| Discoverability | Good (uniform interface) | Poor without an IDL |
| Caching | Native via HTTP | Manual |
| Best for | Public APIs, CRUD-shaped domains | Internal services, action-shaped domains |

**When RPC wins:** operations that genuinely aren't CRUD. "Transfer money between accounts," "cancel and refund," "recalculate rankings" are awkward to model as resource mutations and natural as procedures. Forcing them into REST produces contortions like `POST /transfers` with resources nobody wanted.

gRPC is the modern RPC choice (see above). JSON-RPC and Thrift are alternatives.

### 🆕 API Design Principles

Cross-cutting rules that apply regardless of REST/GraphQL/gRPC:

- **Version from day one.** URL path (`/v1/`) is the most obvious; header-based is cleaner but less discoverable. Never break v1 silently.
- **Paginate everything that returns a list.** Cursor-based beats offset-based at scale (offset gets slower as it grows and skips/duplicates rows under concurrent writes).
- **Use consistent, predictable error shapes.** A machine-readable code, a human-readable message, and a request/trace ID the user can quote to support.
- **Return the right status codes.** 400 vs 401 vs 403 vs 404 vs 409 vs 422 vs 429 all mean different things; using 200 with an error body defeats every piece of HTTP tooling.
- **Rate limit and communicate it** via `X-RateLimit-*` headers and `429` with `Retry-After`.
- **Filter, sort, and sparse-fieldset via query params**, not proliferating endpoints.
- **Accept idempotency keys on all non-idempotent writes.**
- **Long-running operations** → return `202 Accepted` with a status URL, don't hold the connection.
- **Don't leak internal structure** — API shape should reflect the domain, not your table layout.

---

## 9. Reliability Patterns

### Geohashing & Quadtrees

**Geohashing** encodes lat/long into short alphanumeric strings (created by Gustavo Niemeyer, 2008). Hierarchical spatial index using Base-32: each character narrows the location to one of 32 cells, recursively. San Francisco (`37.7564, -122.4016`) → `9q8yy9mf`.

**Key property: shared prefix = spatial proximity.** `9q8yy9mf` and `9q8yy9vx` are close because they share `9q8yy9`. This turns "find nearby" into a string prefix comparison.

Precision by length:

| Length | Cell size |
|---|---|
| 1 | 5000 km |
| 3 | 156 km |
| 5 | 4.89 km |
| 6 | 1.22 × 0.61 km |
| 7 | 153 m |
| 8 | 38.2 × 19.1 m |
| 9 | 4.77 m |
| 12 | ~37 mm |

*Uses:* simple location storage; shareable/memorable URLs; efficient nearest-neighbor search via string comparison and indexes. Also gives **anonymity by truncation** — a shorter hash reveals only an area.

Supported by MySQL, Redis, DynamoDB, Firestore.

**Quadtrees** — tree where each internal node has exactly four children, recursively subdividing 2D space into quadrants. (3D analog: octrees.)

Types: point, point-region (PR), polygonal map (PM), compressed, edge.

**Why not just lat/long + Euclidean distance?** It works in theory but is CPU-intensive and doesn't scale to large datasets. Quadtrees make 2D range queries efficient. You can save further computation by only subdividing a node past a threshold, and improve range query performance with space-filling curves like the **Hilbert curve**.

*Uses:* image representation/compression, spatial indexing and range queries, location-based services (Maps, Uber), mesh generation and graphics, sparse data storage.

### Circuit Breaker

Wrap a remote call in an object that monitors failures. Past a failure threshold, the breaker **trips** and subsequent calls fail immediately without attempting the call. Alert on trips.

**Why:** remote calls fail or hang until timeout. With many callers on an unresponsive dependency, you exhaust critical resources (threads, connections) → **cascading failure across multiple systems.**

**States:**
- **Closed** — normal, requests pass through. Failures past threshold → Open.
- **Open** — return error immediately without invoking the service. After a timeout → Half-open.
- **Half-open** — let a limited number of requests through. Success → Closed. Continued failure → Open.

### Rate Limiting

Caps operation frequency. Protects shared resources and keeps services available.

**Why:** prevent resource starvation from DoS; control operational cost (uncapped autoscaling = exponential bills); mitigate common attacks; control data flow for high-volume APIs.

**Algorithms:**

| Algorithm | Mechanism |
|---|---|
| **Leaky bucket** | FIFO queue drained at a fixed rate; overflow is discarded |
| **Token bucket** | Requests consume tokens; empty bucket = rejection; bucket refills on a schedule |
| **Fixed window** | Counter per n-second window; discard past threshold |
| **Sliding log** | Time-stamped log per request; sum logs in window to get rate |
| **Sliding window** | Hybrid: fixed-window counter + weighted previous window — cheap like fixed window, smooth like sliding log |

**Distributed rate limiting — two hard problems:**

1. **Inconsistency** — per-node limits let a consumer exceed the global limit by spreading requests across nodes. Worse with more nodes. *Sticky sessions* solve it but cost fault tolerance and scalability. A *centralized store* (Redis) solves it but adds latency and race conditions.

2. **Race conditions** — the naive "get-then-set" (read counter, increment, write back) lets concurrent requests all write stale lower values, bypassing the limit. *Distributed locking* works but becomes a bottleneck. Better: **"set-then-get"** — increment atomically, then read.

### Service Discovery

Detecting services on a network. Necessary because modern containerized/virtualized deployments have service instance counts and locations that change dynamically — clients must reach an ephemeral, shifting set of instances.

**Two patterns:**
- **Client-side discovery** — client queries a service registry for locations, then calls directly.
- **Server-side discovery** — client calls an intermediary (load balancer) which forwards to an available instance.

**Service registry** — a database of service instance network locations. **Must be highly available and current** (it's a critical dependency).

**Registration approaches:**
- **Self-registration** — the instance registers/deregisters itself and sends heartbeats to stay alive.
- **Third-party registration** — the registry polls the deployment environment or subscribes to events, recording new instances and removing terminated ones.

**Service mesh** — manages service-to-service communication (observability, security, routing) as complexity grows, working with a discovery protocol. Istio, Envoy.

Tools: etcd, Consul, Apache Thrift, Zookeeper.

### 🆕 Heartbeats

Periodic "I'm alive" signals used for failure detection. The substrate under health checks, leader election, service registries, and presence features.

**Two directions:**
- **Push** — the node periodically sends to a monitor. Simple; the monitor is passive.
- **Pull** — the monitor polls the node (standard HTTP health checks). Easier to add without changing the node.

**The central tension is the timeout value.** Too short → false positives, and you fail over a healthy node (which can cascade). Too long → slow detection, and you route traffic into a black hole. There is no correct static value on a variable network.

**Better than a fixed timeout:** the **phi accrual failure detector** (used by Cassandra and Akka) outputs a continuous *suspicion level* based on the observed distribution of heartbeat intervals rather than a binary alive/dead. This adapts automatically to network conditions.

**Design notes:**
- Heartbeat frequency vs. network overhead scales O(n²) in a naive all-to-all mesh — this is precisely what gossip solves.
- Distinguish **liveness** (process is running) from **readiness** (process can serve traffic). Kubernetes separates these for good reason: a node warming its cache is alive but not ready.
- Deep health checks (verify DB connectivity) catch more but can cause correlated failure — if the DB blips, every node reports unhealthy at once and you lose the entire fleet.

### 🆕 Gossip Protocol

Nodes periodically exchange state with a few randomly chosen peers. Information spreads epidemically until the cluster converges.

**Why:** a central coordinator is a SPOF and a bottleneck; all-to-all heartbeating is O(n²). Gossip is **O(log n) rounds to full propagation** with constant per-node cost — it scales to thousands of nodes.

**Properties:**
- Decentralized, no SPOF.
- Highly fault tolerant — no single node's failure matters.
- **Eventually consistent**, not immediate. Fine for membership and metadata; wrong for anything needing a linearizable answer.
- Robust to network turbulence.

**Variants:** anti-entropy (nodes reconcile full state, used for repair), rumor-mongering (spread a new update until it's "old news"), push / pull / push-pull (push-pull converges fastest).

**Used by:** Cassandra and ScyllaDB (cluster membership and state), DynamoDB, Consul (via SWIM), Riak, Redis Cluster, blockchain peer discovery.

### 🆕 Distributed Tracing

Follows a single request across every service it touches. **In a microservices system, logs and metrics alone cannot tell you where the latency went** — tracing can.

**Model:**
- **Trace** — the whole end-to-end request journey, identified by a trace ID.
- **Span** — one unit of work within it (a service call, a DB query), with start/end timestamps, a parent span ID, and attributes.
- **Context propagation** — the trace and span IDs are passed along in request headers (W3C `traceparent` is the standard) through every hop, including across queues.

**What it gets you:** latency breakdown per service, root-cause identification for slow requests, service dependency maps discovered from real traffic, and error attribution to the actual originating service.

**Practical notes:**
- **Sampling is mandatory** at scale — tracing every request is prohibitively expensive. Head-based sampling decides at ingress (cheap, may miss rare errors); tail-based decides after seeing the whole trace (catches errors and slow outliers, needs buffering).
- **Instrument at the boundaries** — the gateway, service entry/exit, DB clients, queue producers/consumers. That covers most of the value.
- **Propagate through async hops too.** A trace that dies at the message queue hides exactly the part you most want to see.

**Standard + tools:** OpenTelemetry (the vendor-neutral standard — instrument once, export anywhere), Jaeger, Zipkin, AWS X-Ray, Datadog APM, Honeycomb.

**The three pillars of observability:** metrics (aggregate numbers — *what* is wrong), logs (discrete events — *details*), traces (request flow — *where*). You want all three, correlated by trace ID.

---

## 10. Operations & Security

### SLA / SLO / SLI

- **SLA** (Agreement) — the contract with users, covering metrics like availability. Written by business/legal.
- **SLO** (Objective) — a specific promise within the SLA (e.g., 99.9% uptime). Must be simple, clearly defined, easily measured.
- **SLI** (Indicator) — the measured value of the SLO's metric. **SLI must meet or exceed SLO to stay compliant with the SLA.**

Together they let you define, track, and monitor promises — and generate user trust with continuous improvement to incident response.

### Disaster Recovery

Regaining access and functionality after a disaster, attack, or major disruption. Relies on replicating data and processing to an unaffected off-premises location.

**Terms:**
- **RTO** (Recovery Time Objective) — maximum acceptable delay between service interruption and restoration. *How long can we be down?*
- **RPO** (Recovery Point Objective) — maximum acceptable time since the last recovery point. *How much data can we lose?*

**Strategies (cheapest → most expensive):**
- **Backup** — data stored off-site or on removable media. Simplest.
- **Cold site** — basic infrastructure stood up at a second location. Cheap, slow recovery.
- **Hot site** — up-to-date data copies maintained at all times. Expensive and time-consuming to set up, but dramatically reduces downtime.

*Benefits:* minimize interruption and downtime, limit damages, fast restoration, better customer retention.

### VMs vs Containers

**Virtual Machine** — virtual environment with its own CPU, memory, network interface, and storage, created on physical hardware. A **hypervisor** (VMM) separates machine resources from the hardware, treating CPU/memory/storage as a pool that can be reallocated between guests. VMs are isolated, multiple can share a host, and they can migrate between hosts.

*Why VMs:* server consolidation (most deployments use a fraction of available physical resources); isolation for testing and production; single-purpose VMs per use case.

**Container** — standard unit packaging code plus all dependencies (runtime versions, libraries) so the app runs identically anywhere. Abstracts the app from its environment.

*Why containers:* separation of responsibility (devs own logic and deps, ops owns deployment); workload portability; application isolation (virtualizes CPU/memory/storage/network at the OS level); agile development (no dependency/environment concerns); efficient operations (lightweight, use only what you need).

**The core difference:** a hypervisor virtualizes **hardware** — each VM carries a full guest OS plus a virtual copy of required hardware. Containers virtualize the **operating system** — each container carries only the app and its dependencies, sharing the host kernel and using a fraction of the memory.

### OAuth 2.0 & OpenID Connect

**OAuth 2.0** = *authorization*, not authentication. Grants consented access to resources on behalf of a user without ever sharing credentials.

**Entities:** Resource Owner (the user), Client (the system wanting access), Authorization Server (issues access tokens after auth + consent), Resource Server (protects resources, validates tokens), Scopes (exactly what access is granted), Access Token (represents the granted authorization).

**Flow:**
1. Client requests authorization from the Authorization Server with client id/secret, scopes, and a redirect URI.
2. Authorization Server authenticates the client and verifies the requested scopes.
3. Resource owner grants access.
4. Authorization Server redirects back with an Authorization Code or Access Token (depending on grant type); may include a Refresh Token.
5. Client uses the Access Token to request resources from the Resource Server.

*Disadvantages:* lacks built-in security features, no standard implementation, no common set of scopes.

**OpenID Connect (OIDC)** — a thin identity layer on top of OAuth 2.0, adding login and profile information. An Authorization Server supporting OIDC is often called an **Identity Provider (IdP)**.

**Entities:** Relying Party (the app), OpenID Provider (issues a one-time code), Token Endpoint (exchanges the OTC for an access token — **the key difference from plain OAuth: the token is a JWT**), UserInfo Endpoint (returns end-user info given a valid token).

Both are JSON-based and widely supported; OIDC's spec is stricter than base OAuth.

### Single Sign-On (SSO)

One credential set grants access to many applications. Credentials are held by a centralized, trusted **Identity Provider**.

**Components:**
- **Identity Provider (IdP)** — stores and manages identity; authenticates the user directly (username/password) or validates an assertion from another IdP; frees service providers from identity management.
- **Service Provider** — provides the actual service; relies on IdPs for identity assertions; may keep a local account with service-specific attributes.
- **Identity Broker** — intermediary connecting multiple service providers to multiple identity providers, abstracting away protocol differences.

**SAML** — open XML standard for sharing identity, authentication, and permission info across systems. Enables **identity federation**: IdPs securely pass authenticated identities and attributes to service providers.

**Flow:** user requests a resource → app redirects to IdP → user signs in → IdP sends an SSO response to the app → app grants access.

**SAML vs OAuth/OIDC:**

| | SAML | OAuth 2.0 / OIDC |
|---|---|---|
| Format | XML | JSON |
| Style | Enterprise security | Simpler UX, RESTful |
| Session | Drops a session cookie | Token-based |
| Best for | Enterprise, short-lived workloads | Mobile and modern web |
| Implementation | Complex to install/maintain | Developer-friendly, fast with free libraries |
| Consent | Possible, but hand-coded | Built into the protocol |

*Pros:* one credential set to remember; no repeated authorization flows; enforced security and compliance; simpler management, lower IT support cost.
*Cons:* **single password vulnerability** — compromise the SSO password and every connected app is compromised; slower than traditional auth since every app verifies with the SSO provider.

IdPs: Okta, Google, Auth0, OneLogin.

### SSL / TLS / mTLS

**SSL** — Secure Sockets Layer, 1995, deprecated in favor of TLS. Certificates are still called "SSL certificates" because providers kept the naming. Originally solved plaintext transmission on the web, protecting privacy and preventing in-transit tampering.

**TLS** — the current standard. Three guarantees:
- **Encryption** — hides transferred data from third parties.
- **Authentication** — verifies parties are who they claim to be.
- **Integrity** — verifies data hasn't been forged or tampered with.

**mTLS** — mutual TLS. *Both* ends verify they hold the correct private key, with certificate info providing additional verification. Secures traffic in both directions. Essential for verifying clients that never go through a login flow (IoT devices), and standard for microservices in a **zero trust** model.

---

## 11. Interview / Design Framework

The same framework works for real design docs. It's a sequence, and skipping steps shows.

### 1. Clarify requirements
Design questions are deliberately vague. Ask before designing.

- **Functional** — what the user explicitly needs. *"What features must this support?" "What edge cases matter?"*
- **Non-functional** — quality constraints. Latency, availability, scalability, security, portability, maintainability. *"Each request should be processed with minimum latency." "The system should be highly available."*
- **Extended** — nice-to-haves, possibly out of scope. Metrics and analytics, health monitoring.

### 2. Estimation and constraints
- What scale must this handle?
- What's the read/write ratio?
- Requests per second?
- Storage needed?

These numbers drive every later decision. Confirm your assumptions out loud.

### 3. Data model design
Define entities and relationships early — data flow is the core of every system.
- What are the entities? What are their relationships?
- How many tables?
- Is NoSQL a better fit here?

### 4. API design
Define the interface explicitly. No code, just signatures:
```
createUser(name: string, email: string): User
```
Keep it simple; revisit when covering extended requirements.

### 5. High-level component design
Identify components (load balancers, gateways, queues, caches, stores) and draft the first architecture.
- Monolith or microservices?
- What kind of database?

Then walk the flow from the client's perspective.

### 6. Detailed design
Go deep on major components. Present alternatives with tradeoffs and back decisions with examples.
- How do we partition the data?
- How is load distributed?
- Do we cache? Where?
- How do we handle a sudden traffic spike?

**Avoid dogma.** "NoSQL is just better, SQL doesn't scale" reads poorly. Be humble about what you know and don't.

### 7. Identify and resolve bottlenecks
- Enough database replicas?
- Any single point of failure?
- Is sharding needed?
- How do we make this more robust?
- How do we make the cache highly available?

**Tip:** read the engineering blog of the company you're interviewing with — it tells you their stack and the problems they care about.

---

## 12. Case Study Playbooks

Reusable architectural moves, organized by the problem they solve.

### URL Shortener

**Shape:** read-heavy, ~100:1 read/write.

**Key generation — three approaches:**

1. **Base62 encoding** (A-Z, a-z, 0-9). `62^N` possible URLs: 62⁵ ≈ 916M, 62⁶ ≈ 56.8B, 62⁷ ≈ 3.5T. Simplest, but **doesn't guarantee collision-free keys**.
2. **MD5 → base62**, truncated to 7 chars. Introduces duplication and collision; recomputing on collision adds overhead.
3. **Counter + distributed coordination.** A counter returns a unique incrementing number, base62-encoded. Naive single counter = SPOF; multiple counters = collisions. **Solution: Zookeeper hands each server a distinct counter range** (1–1M, 1,000,001–2M, …). When a server exhausts its range it gets a new one. Guarantees uniqueness, no SPOF (run multiple Zookeeper instances).

**Key Generation Service (KGS):** pre-generate unique keys offline and store them in a separate database. Simplest correct design.
- *Concurrency:* two servers could grab the same key. Move used keys to a separate table with proper locking as soon as they're taken. Keep some keys in memory for read speed.
- *Sizing:* ~56.8B six-character keys ≈ 390 GB. Large, but it's a one-time lifetime cost that doesn't grow like the main table.

**Request flow:**
- *Create:* API server requests a key from KGS → KGS returns and marks it used → API writes the URL entry to DB and cache → return **201 Created**.
- *Redirect:* request hits cache → on miss, read from DB → issue **301 Redirect** → if not found, **404**.

**Other details:** hash-based data partitioning; database cleanup for expired links (lazy deletion on access is cheaper than a sweep); Redis/Memcached for the hot 20%; API keys for rate limiting per user.

### WhatsApp (Chat)

**Services:** User (HTTP — auth and profile), Chat (**WebSockets** — messages, groups; cache tracks active connections as sessions), Notification, Presence (last seen), Media (uploads).

**Inter-service:** REST works, **gRPC is better** — lighter and more efficient. Add service discovery and consider a service mesh.

**Real-time messaging — push beats pull.** Pull (long polling) doesn't scale: constant request overhead, mostly empty responses. Push via WebSockets minimizes latency and gives **full-duplex** (unlike SSE, which is one-way).

**Last seen — two approaches:**
1. **Heartbeat** — client periodically pings; store `user → timestamp` in Redis/Memcached. Low overhead.
2. **Lazy / activity-threshold** — track the user's last action; if nothing for e.g. 30 seconds, mark offline with the last recorded timestamp. Sometimes better than heartbeats.

**Notifications:** check recipient activity (active connection + last seen). If inactive, chat service pushes an event to a **message queue** with device-platform metadata. Notification service consumes and forwards to FCM (Android/web) or APNS (iOS).
- *Why a queue and not pub/sub?* Queues give best-effort ordering and at-least-once delivery. And despite appearances this **isn't** classic fanout — mobile platforms each handle push their own way, and delivery goes through FCM/APNS externally rather than fanning out internally. SQS or RabbitMQ fits.

**Read receipts:** wait for a client ACK to set `deliveredAt`; set `seenAt` when the user opens the chat.

### Twitter (Feed)

**Services:** User, Newsfeed, Tweet, Search, Media, Notification, Analytics.

**Feed generation:**
1. Get IDs of everyone/everything the user follows.
2. Fetch relevant tweets for each.
3. Rank by relevance, time, engagement.
4. Return paginated.

This is expensive for users following many accounts. **Pre-generate and cache the feed**, then periodically update it and rank new tweets incrementally.

**Feed publishing — the classic tradeoff:**

| Model | Mechanism | Cost |
|---|---|---|
| **Pull (fan-out on load)** | Feed built when the user requests it | Fewer writes, more reads; users don't see new content until they pull |
| **Push (fan-out on write)** | Tweet pushed to all follower feeds immediately | Fewer reads, **far more writes** — brutal for accounts with millions of followers |
| **Hybrid** | Push for normal users, pull for celebrities | Best of both — the standard production answer |

**Ranking:** Facebook's original EdgeRank was `Rank = Affinity × Weight × Decay`, where affinity is closeness between viewer and creator, weight is per-interaction-type (comments > likes), and decay reduces rank with age. Modern systems use ML models with thousands of features — but EdgeRank is the right mental model to explain.

**Retweets:** simplest version reuses the tweets table — new row with the retweeting user's ID, `type = tweet`, and `content = original tweet ID`. Better: a dedicated retweets table.

**Search:** relational DBs aren't fast enough for full-text at scale. **Elasticsearch** (built on Apache Lucene) handles textual, numerical, geospatial, structured, and unstructured data in near real-time.

**Trending:** built on search. Cache the most frequent queries/hashtags/topics over the last N seconds, refreshed every M seconds via a batch job. Apply the ranking algorithm to weight and personalize.

### Netflix (Video)

**Video processing pipeline** — uploads land in a message queue, then:

1. **File chunker** — split into chunks. Dedupes repeating data and reduces network transfer (only changed chunks). **Netflix splits on *scene boundaries*, not equal timestamps** — so a requested chunk contains a complete scene, meaning fewer playback interruptions.
2. **Content filter** — ML model performing copyright, piracy, and NSFW checks. Failures go to a **dead-letter queue** for human moderation.
3. **Transcoder** — decode to an intermediate uncompressed format, re-encode to target format using codecs. Handles bitrate adjustment, downsampling, re-encoding. FFmpeg or AWS Elemental MediaConvert.
4. **Quality conversion** — produce 4K/1440p/1080p/720p variants. Finished media goes to HDFS/GlusterFS or object storage (S3).

Optional additional steps: subtitle and thumbnail generation.

*Why a queue?* Video processing is long-running. A queue decouples it from upload and lets each stage scale independently.

**Streaming:**
- **CDN** so users don't refetch the same content.
- **Netflix Open Connect** goes further — a purpose-built CDN with **Open Connect Appliances in 1000+ locations**, partnering with ISPs so ~95% of global traffic is delivered over direct connections. OCAs can fail over to Netflix servers.
- **Adaptive bitrate streaming** (HLS) dynamically adapts to available connection speed.
- **Resume playback** using a stored `offset` in the views table to fetch the chunk at that timestamp.

**Search + trending:** same Elasticsearch pattern as Twitter.
**Sharing:** a URL shortener service for shareable links.
**Geo-blocking:** region-based access rules on the content delivery path.

### Uber (Location Matching)

**Flow:** customer requests ride (source, destination, cab type, payment) → ride service registers it, finds nearby drivers, calculates ETA → broadcast to nearby drivers to accept/deny → on accept, customer sees live driver location + ETA → pickup → trip → completion + payment → rating.

**Location tracking:** same push-vs-pull conclusion as WhatsApp — **WebSockets**. Pull wastes resources on mostly-empty responses. Client also needs a background job to report GPS while the app is backgrounded.

**Ride matching — three options, in increasing order of correctness:**

1. **SQL bounding box:**
   ```sql
   SELECT * FROM locations WHERE lat BETWEEN X-R AND X+R AND long BETWEEN Y-R AND Y+R
   ```
   Works, **doesn't scale** — slow on large datasets.

2. **Geohashing** — encode driver and customer locations as geohashes; find nearby drivers by prefix comparison. Index and keep driver geohashes **in memory** for fast retrieval.

3. **Quadtrees** — best fit. Update the quadtree on every driver location update. **Cache the latest updates in Redis to reduce load on quadtree servers.** Use Hilbert curve mapping for efficient range queries.

**Race conditions:** many simultaneous ride requests will collide. Wrap matching logic in a **mutex** and make every action transactional.

**Driver selection:** from the nearby candidates, rank by average rating, relevance, past feedback — broadcast to the best drivers first.

**Surge pricing:** dynamic price increase in response to high demand and limited supply, added to the base trip price.

**Payments:** use a third-party processor (Stripe, PayPal). Capture payment data via **webhook** after the processor redirects back.

**Notifications:** Kafka + notification service → FCM/APNS. (Same pattern across all four consumer case studies.)

### Cross-Cutting Patterns

These recur in every case study — internalize them:

| Pattern | Appears in |
|---|---|
| Microservices with per-service data ownership | WhatsApp, Twitter, Netflix, Uber |
| gRPC for inter-service, REST/WS for clients | All |
| WebSockets for anything real-time | WhatsApp, Uber |
| Message queue + FCM/APNS for push notifications | All four |
| Elasticsearch for search, cache + batch job for trending | Twitter, Netflix |
| CDN for media delivery | WhatsApp, Twitter, Netflix |
| API gateway at the edge | All |
| Cache the hot 20% (Pareto) | All |
| Hash-based partitioning as the first sharding move | All |

---

## 13. Estimation Cheat Sheet

### Powers of two

| Power | Approx | Name |
|---|---|---|
| 2¹⁰ | 1 thousand | 1 KB |
| 2²⁰ | 1 million | 1 MB |
| 2³⁰ | 1 billion | 1 GB |
| 2⁴⁰ | 1 trillion | 1 TB |
| 2⁵⁰ | 1 quadrillion | 1 PB |

### Time conversions

- **1 million/month ≈ 0.4/second**
- **1 request/second = 2.6M requests/month**
- Seconds per day: 86,400 (**~100K**)
- Seconds per month: ~2.6M

Quick trick: **X million per month ÷ 2.5 ≈ X requests per second.**

### Latency numbers (order of magnitude)

| Operation | Time |
|---|---|
| L1 cache reference | 0.5 ns |
| Main memory reference | 100 ns |
| Compress 1 KB | 3 µs |
| Send 1 KB over 1 Gbps | 10 µs |
| SSD random read | 150 µs |
| Read 1 MB from memory | 250 µs |
| Round trip within datacenter | 500 µs |
| Read 1 MB from SSD | 1 ms |
| Disk seek | 10 ms |
| Read 1 MB from disk | 20 ms |
| Packet CA → Netherlands → CA | 150 ms |

**Takeaways:** memory is ~100× faster than SSD, ~1000× faster than disk. Cross-continent round trips dominate everything else — this is why CDNs exist.

### Estimation recipe

1. **Traffic** — start from DAU or monthly actions. Apply the read/write ratio. Convert to RPS. Compute peak as **2–3× average**.
2. **Bandwidth** — RPS × average payload size. Do incoming and outgoing separately (they're often wildly different).
3. **Storage** — records/day × record size × retention period. Add replication factor.
4. **Cache** — apply the **80/20 Pareto rule**: cache 20% of daily requests. Memory = daily requests × 0.2 × record size.
5. **Servers** — total RPS ÷ per-server RPS capacity, then add headroom.

**Always state your assumptions out loud and round aggressively.** Nobody wants three significant figures; they want to see whether you know that 100M/month is ~40/second.

---

## 14. Tradeoffs Reference

🆕 The recurring decisions. Most design discussions are one of these in disguise — naming the tradeoff out loud is half the work.

### Quick index

| Tradeoff | Choose left when | Choose right when |
|---|---|---|
| Vertical ↔ Horizontal scaling | Simplicity matters, load is predictable | Need redundancy, past single-machine limits |
| Strong ↔ Eventual consistency | Money, inventory, identity | Feeds, counts, analytics, presence |
| Latency ↔ Throughput | Interactive user-facing paths | Bulk processing, analytics |
| Consistency ↔ Availability | Correctness beats uptime | Uptime beats freshness |
| Normalization ↔ Denormalization | Write-heavy, integrity critical | Read-heavy, joins are the bottleneck |
| Stateful ↔ Stateless | State can't be externalized | Almost always |
| Sync ↔ Async | Caller needs the result now | Caller doesn't |
| Batch ↔ Stream | Latency tolerance is hours | Latency tolerance is seconds |
| Push ↔ Pull | Consumers are few and known | Consumers are many, or heterogeneous |
| Monolith ↔ Microservices | One team, coupled domain | Many teams blocking each other |
| SQL ↔ NoSQL | Relations and transactions | Scale and schema flexibility |
| Read-through ↔ Write-through | Optimizing reads | Optimizing consistency |
| REST ↔ RPC | Resource-shaped, public | Action-shaped, internal |
| Security ↔ Usability | Regulated, high-value data | Consumer growth products |
| Cost ↔ Performance | Startup runway | Revenue depends on speed |

### The ones worth expanding

**Concurrency vs Parallelism**
- **Concurrency** = dealing with many things at once (structure). Tasks interleave; possible on a single core.
- **Parallelism** = doing many things at once (execution). Requires multiple cores.
- Concurrency is about *composition*; parallelism is about *execution*. You can have concurrency without parallelism (Node.js event loop, Python asyncio), and parallelism without meaningful concurrency (SIMD vector math).
- **Practical rule:** I/O-bound work → concurrency (async, event loops, more threads than cores). CPU-bound work → parallelism (multiprocessing, more cores). Getting this backwards is the single most common performance mistake — adding threads to CPU-bound work just adds context-switch overhead.

**Batch vs Stream Processing**

| | Batch | Stream |
|---|---|---|
| Data | Bounded, at rest | Unbounded, in motion |
| Latency | Minutes to hours | Milliseconds to seconds |
| Throughput | Very high | High |
| Complexity | Lower | Higher (windowing, late data, out-of-order events) |
| Reprocessing | Trivial — just rerun | Hard — need replay from the log |
| Correctness | Easier to reason about | Must handle late/duplicate/out-of-order events |
| Tools | Spark, Hadoop, dbt, Airflow | Kafka Streams, Flink, Spark Streaming |

**Lambda architecture** runs both (batch layer for correctness, speed layer for freshness) — powerful but you maintain two codebases. **Kappa architecture** runs stream-only and reprocesses by replaying the log — simpler, and now the more common choice.

Key stream concepts: **event time vs processing time** (they differ, and the gap is where bugs live), **watermarks** (how long you wait for late data), **windowing** (tumbling, sliding, session).

**Stateful vs Stateless**
- **Stateless** — no request-scoped state retained between requests. Any instance can serve any request. Trivially horizontally scalable, trivially replaceable, health checks are simple, no session affinity needed. **This should be your default.**
- **Stateful** — instance retains state. Requires sticky sessions, complicates scaling and deploys, node loss means state loss.
- **The move:** externalize state. Push sessions to Redis, files to object storage, and keep the compute tier stateless. The state hasn't disappeared — you've relocated it to a system designed to manage it.
- **When stateful is legitimate:** real-time game servers, WebSocket connection state, in-memory computation over large working sets, databases themselves (Kubernetes StatefulSets exist for exactly this).

**Push vs Pull**

| | Push | Pull |
|---|---|---|
| Latency | Low — sent as it happens | Bounded by poll interval |
| Consumer control | Little — can be overwhelmed | Full — consume at your own rate |
| Backpressure | Hard | Natural |
| Fan-out cost | High for many consumers | Cost is on the consumer |
| Delivery tracking | Producer must track | Consumer tracks offset |

Kafka is famously **pull-based** so consumers control their rate and can replay by offset. Push is right when latency matters and consumers are known; pull is right for high fan-out and heterogeneous consumer speeds. The hybrid feed model in §12 (push for normal users, pull for celebrities) is the canonical worked example.

**Synchronous vs Asynchronous**
- **Sync** — caller blocks until the callee responds. Simple, immediately consistent, easy to debug — but couples availability (see the sequence-availability math in §3: every sync dependency multiplies down your uptime) and propagates latency and failure.
- **Async** — caller fires and continues. Decoupled, resilient, absorbs spikes, scales independently — but eventually consistent, harder to debug, needs idempotency and error-handling infrastructure.
- **Rule:** if the user needs the answer to proceed, sync. Otherwise queue it. "Send confirmation email" should never be in the request path.

**Security vs Usability**
Every auth control adds friction. MFA, short session timeouts, strict password rules, and rate limits all reduce risk and increase abandonment. Resolve it by **tiering**: low-risk actions get low friction, high-risk actions (changing a password, moving money, adding a payout account) get step-up authentication. Risk-based auth — challenge only anomalous sessions — is the modern answer.

**Cost vs Performance**
Almost every performance lever costs money: more replicas, bigger caches, more regions, faster storage tiers. Make the tradeoff explicit by tying it to a metric someone cares about — "p99 drops from 800ms to 200ms for $4k/month" is a decision; "we should optimize latency" is not. Watch for the cost inversions: serverless is cheap at low volume and expensive at high; reserved capacity is the reverse.

---

## 15. Algorithm Implementations

🆕 The algorithms you may actually be asked to code, described mechanically. Pseudocode below is written from scratch — reference implementations in Java and Python exist in source repo #2 under `implementations/`.

### Rate Limiting

All five share the interface `allow_request() -> bool`.

**1. Fixed Window Counter**
```
state: window_size, max_requests, current_window, count

allow_request():
    window = floor(now / window_size)
    if window != current_window:        # new window → reset
        current_window = window
        count = 0
    if count < max_requests:
        count += 1
        return true
    return false
```
Simplest and cheapest — O(1) time and space. **Fatal flaw: boundary bursts.** With a limit of 5/minute, a client can send 5 at 0:59 and 5 at 1:01 — 10 requests in 2 seconds, all "legal."

**2. Sliding Window Log**
```
state: window_size, max_requests, log (deque of timestamps)

allow_request():
    evict from front of log while now - log.front >= window_size
    if len(log) < max_requests:
        log.append(now)
        return true
    return false
```
**Perfectly accurate** — no boundary problem. Cost: O(n) memory per client, where n is the request limit. Expensive for high limits or many clients.

**3. Sliding Window Counter**
```
state: window_size, max_requests, current_window, count, previous_count

allow_request():
    window = floor(now / window_size)
    if window != current_window:
        previous_count = count
        count = 0
        current_window = window
    elapsed_fraction = (now mod window_size) / window_size
    estimate = previous_count * (1 - elapsed_fraction) + count
    if estimate < max_requests:
        count += 1
        return true
    return false
```
**The practical winner.** O(1) memory like fixed window, smooths the boundary like the log. Weights the previous window's count by how much of the current window has elapsed. Slightly approximate — assumes uniform distribution within the previous window — which is fine in practice.

**4. Token Bucket**
```
state: capacity, fill_rate, tokens (starts full), last_time

allow_request(cost = 1):
    tokens = min(capacity, tokens + (now - last_time) * fill_rate)
    last_time = now
    if tokens >= cost:
        tokens -= cost
        return true
    return false
```
**Allows controlled bursts** up to `capacity` while enforcing an average rate of `fill_rate`. Tokens accrue lazily — no background timer needed. The variable `cost` parameter lets you weight expensive endpoints more heavily. This is what most cloud APIs actually use.

**5. Leaky Bucket**
```
state: capacity, leak_rate, bucket (queue), last_leak

allow_request():
    leaked = floor((now - last_leak) * leak_rate)
    if leaked > 0:
        remove min(leaked, len(bucket)) items from front
        last_leak = now
    if len(bucket) < capacity:
        bucket.append(now)
        return true
    return false
```
**Enforces a perfectly smooth output rate** — no bursts pass through. Good for protecting a downstream service with fixed capacity. The queueing variant delays rather than rejects; the counter variant rejects immediately.

**Choosing:**

| Need | Use |
|---|---|
| Simplest possible | Fixed window |
| Exact enforcement, small limits | Sliding window log |
| Best general-purpose | **Sliding window counter** |
| Allow bursts, average rate | **Token bucket** |
| Smooth constant output | Leaky bucket |

**Distributed notes:** keep counters in Redis, and do the read-modify-write atomically via a Lua script or `INCR` + `EXPIRE` — never get-then-set (see the race condition in §9). Key by `user:endpoint:window`. Set TTLs so keys expire on their own.

### Load Balancing

**Round Robin** — maintain an index, increment modulo server count.

**Weighted Round Robin** — the standard smooth algorithm walks the server list while tracking a `current_weight` that decrements each full pass; a server is selected when its weight is at least the current threshold, and the threshold resets to `max(weights)` when it drops to zero. Result: a server with weight 5 out of `[5,1,1]` gets 5 of every 7 requests, distributed rather than clumped.

**Least Connections** — track an active-connection count per server; select the minimum; increment on dispatch and decrement on completion. Requires accurate completion signals.

**Least Response Time** — track a rolling average response time per server; select the minimum. Update after each request completes. Use an EWMA rather than a raw last-value to avoid oscillation.

**IP Hash** — `server = servers[hash(client_ip) mod N]`. Same client always lands on the same server, giving stickiness with no shared state. **Its weakness is the entire motivation for consistent hashing**: changing N remaps nearly every client.

### Consistent Hashing

```
state: ring (map hash → server), sorted_hashes (sorted list), replicas (virtual nodes per server)

add_server(s):
    for i in 0..replicas-1:
        h = hash(s + "-" + i)       # distinct virtual node per i
        ring[h] = s
        insert h into sorted_hashes, keeping it sorted

remove_server(s):
    for i in 0..replicas-1:
        h = hash(s + "-" + i)
        delete ring[h]; remove h from sorted_hashes

get_server(key):
    if ring empty: return null
    h = hash(key)
    idx = binary_search_right(sorted_hashes, h) mod len(sorted_hashes)   # wrap around
    return ring[sorted_hashes[idx]]
```

**The three details that make it work:**
1. **Sorted array + binary search** gives O(log n) lookup. A naive linear scan is the common mistake.
2. **The modulo on the search result** handles wraparound — a key hashing past the last node belongs to the first.
3. **Virtual nodes** come from hashing `server-0`, `server-1`, … `server-k` so each physical server occupies k scattered positions. More replicas → smoother distribution. 100–200 virtual nodes per server is typical in production; textbook examples use 3.

**Complexity:** add/remove server O(k log n); lookup O(log n); keys remapped on change ≈ K/N.

Any decent hash works (MD5 is common in examples for its uniform distribution — it's not being used for security here). Production systems often prefer faster non-cryptographic hashes like MurmurHash or xxHash.

---

## 16. Problem Catalog

🆕 Design problems worth working through, roughly by difficulty. The five with detailed playbooks in §12 are marked ★.

**Foundational** — single dominant concept each; good for isolating a technique.

| Problem | Core concept it teaches |
|---|---|
| ★ URL shortener | Key generation, base62, read-heavy caching |
| Rate limiter | The algorithms in §15, distributed counters |
| Load balancer | Routing algorithms, health checks |
| Distributed cache | Consistent hashing, eviction, replication |
| Distributed key-value store | Quorums, replication, partitioning (the Dynamo paper) |
| CDN | Edge caching, invalidation, geo-routing |
| Autocomplete / typeahead | Tries, prefix search, ranking, caching |
| Authentication system | Sessions vs tokens, OAuth/OIDC, password storage |
| Parking garage / vending machine | Object modeling and state machines (low-level design) |

**Intermediate** — multiple interacting concerns.

| Problem | Core concept it teaches |
|---|---|
| ★ WhatsApp / chat | WebSockets, presence, delivery receipts, fanout |
| ★ Twitter / news feed | Fanout on read vs write, ranking, the celebrity problem |
| ★ Netflix / YouTube | Video pipeline, transcoding, adaptive bitrate, CDN |
| Instagram | Feed + media storage + social graph |
| Spotify | Streaming, playlists, recommendations, offline sync |
| Notification service | Multi-channel fanout, templating, preferences, retries |
| Distributed job scheduler | Leader election, at-least-once execution, cron semantics |
| Distributed message queue (Kafka) | Partitioned logs, offsets, consumer groups, replication |
| E-commerce store | Inventory consistency, cart, checkout, search |
| Payment system | **Idempotency**, ledgers, double-entry, reconciliation |
| Digital wallet | Transactions, balance consistency, audit trail |
| Ticket booking | Seat locking, reservation expiry, high-contention writes |
| Flight booking | Search across providers, caching, price volatility |
| Analytics / metrics platform | Ingestion at scale, time-series storage, aggregation |
| Reddit / forum | Nested comments, voting, ranking algorithms |
| Tinder | Geospatial matching, swipe storage, recommendation |
| Google Search | Crawling, indexing, ranking, query serving |

**Advanced** — genuinely hard distributed problems.

| Problem | Core concept it teaches |
|---|---|
| ★ Uber / ride-hailing | Geospatial indexing (quadtrees), matching, real-time location |
| Yelp / proximity service | Geohashing, spatial search, ranking |
| Doordash | Three-sided marketplace, routing, ETA prediction |
| Google Docs | **Operational transformation / CRDTs**, real-time collaboration |
| Google Maps | Graph algorithms at scale, tiling, routing, traffic |
| Zoom | WebRTC, SFU/MCU media servers, network adaptation |
| Dropbox / file sync | Chunking, dedup, sync conflict resolution, delta transfer |
| Web crawler | Politeness, dedup (Bloom filters), frontier management, traps |
| S3 / object storage | Durability math, erasure coding, consistency |
| Code deployment system | Artifact distribution, rollback, blue-green/canary |
| Distributed locking service | Consensus, leases, fencing tokens (Chubby paper) |

**Suggested sequence if working through these:** URL shortener → rate limiter → distributed cache → chat → news feed → payment system → geospatial → collaborative editing. Each builds on the last.

---

## 17. Further Reading

🆕 Curated from source repo #2, which is primarily a link index.

### Foundational papers

Read in roughly this order — each is genuinely worth the time.

| Paper | Why it matters |
|---|---|
| **Dynamo: Amazon's Highly Available Key-Value Store** (2007) | The origin of consistent hashing + vector clocks + quorums in production. Underpins Cassandra, Riak, DynamoDB |
| **Bigtable: A Distributed Storage System for Structured Data** (2006) | Wide-column model, LSM-based storage. Underpins HBase, Cassandra's data model |
| **The Google File System** (2003) | Large-scale distributed storage design; direct ancestor of HDFS |
| **MapReduce: Simplified Data Processing on Large Clusters** (2004) | The batch-processing model that launched the big-data era |
| **Kafka: a Distributed Messaging System for Log Processing** | The distributed log as a primitive — arguably the most influential idea in modern data architecture |
| **Spanner: Google's Globally-Distributed Database** (2012) | Globally distributed with external consistency via TrueTime. Shows CAP isn't the whole story |
| **The Log-Structured Merge-Tree (LSM-Tree)** (1996) | The storage structure under most modern write-optimized databases |
| **ZooKeeper: Wait-free Coordination for Internet-scale Systems** | Practical coordination service design |
| **The Chubby Lock Service** (2006) | Distributed locking done properly; the reference for locks + consensus |
| **Paxos: The Part-Time Parliament** (Lamport) | The original consensus algorithm. Read Raft's paper first if Paxos is rough going |

### Engineering blog posts

Real systems, real numbers — far more instructive than generic tutorials.

- **How Discord stores trillions of messages** — Cassandra → ScyllaDB migration, partitioning strategy, and why they moved
- **Building In-Video Search at Netflix** — ML + search at scale
- **How Canva scaled media uploads from zero to 50 million/day** — a practical scaling narrative with the actual bottlenecks
- **How Airbnb avoids double payments in a distributed payments system** — the canonical idempotency case study
- **Stripe's payments APIs: the first 10 years** — API design and versioning done unusually well
- **Real-time messaging at Slack** — WebSocket architecture at scale

Also worth following: the Netflix, Uber, Meta, Cloudflare, Discord, Figma, and Stripe engineering blogs. **Read the blog of any company you're interviewing with** — it tells you their stack and their actual problems.

### Books

- **Designing Data-Intensive Applications** (Kleppmann) — the single best book on this subject. If you read one thing, read this.
- *Database Internals* (Petrov) — deeper on storage engines and distributed algorithms
- *Site Reliability Engineering* (Google) — the operational half of the picture
- *Release It!* (Nygard) — stability patterns; where circuit breakers and bulkheads come from

### Video channels

ByteByteGo, Gaurav Sen, Tech Dummies Narendra L, codeKarle, System Design Interview, sudoCODE, Success in Tech.

### Interactive / course resources

- AlgoMaster (`algomaster.io`) — the courses and concept pages source repo #2 indexes
- `karanpratapsingh.com/courses/system-design` — the hosted version of source repo #1

---
## Appendix: Topic → Section Index

For fast lookup when this doc is used as project context.

`IP` `OSI` `TCP/UDP` `DNS` `HTTP` `HTTPS` `HTTP/2` `HTTP/3` `QUIC` `checksums` `CRC` → §1 ·
`load balancing` `round robin` `least connections` `IP hash` `caching` `cache-aside` `read-through` `write-through` `write-back` `thundering herd` `cache stampede` `CDN` `push CDN` `pull CDN` `proxy` `reverse proxy` → §2 ·
`availability` `nines` `SPOF` `failover` `split-brain` `quorum` `fencing` `latency` `throughput` `bandwidth` `p99` `tail latency` `scalability` `clustering` `active-active` → §3 ·
`RAID` `block storage` `object storage` `HDFS` `SQL` `NoSQL` `document` `key-value` `graph` `time series` `wide column` `replication` `indexes` `dense` `sparse` `bloom filter` `HyperLogLog` `count-min sketch` `LSM tree` `B-tree` `database scaling` `normalization` `1NF` `2NF` `3NF` `BCNF` → §4 ·
`ACID` `BASE` `CAP` `PACELC` `transactions` `2PC` `3PC` `sagas` `choreography` `orchestration` `consensus` `Paxos` `Raft` `Zab` `distributed locking` `Redlock` `fencing tokens` → §5 ·
`sharding` `partitioning` `consistent hashing` `virtual nodes` `hash ring` `federation` → §6 ·
`client-server` `serverless` `cold start` `P2P` `DHT` `n-tier` `message brokers` `queues` `pub/sub` `CDC` `Debezium` `outbox pattern` `dual write` `ESB` `monolith` `microservices` `distributed monolith` `SOA` `EDA` `event sourcing` `CQRS` `API gateway` `BFF` → §7 ·
`REST` `GraphQL` `gRPC` `protobuf` `long polling` `WebSockets` `SSE` `webhooks` `idempotency` `idempotency keys` `REST vs RPC` `pagination` `API versioning` → §8 ·
`geohashing` `quadtrees` `Hilbert curve` `circuit breaker` `rate limiting` `token bucket` `leaky bucket` `sliding window` `service discovery` `service mesh` `heartbeats` `phi accrual` `gossip` `SWIM` `distributed tracing` `OpenTelemetry` `observability` → §9 ·
`SLA` `SLO` `SLI` `RTO` `RPO` `disaster recovery` `VMs` `hypervisor` `containers` `OAuth` `OIDC` `JWT` `SSO` `SAML` `IdP` `SSL` `TLS` `mTLS` `zero trust` → §10 ·
`interview framework` `requirements` `functional` `non-functional` → §11 ·
`URL shortener` `WhatsApp` `Twitter` `Netflix` `Uber` `fanout` `newsfeed` `ranking` `EdgeRank` `transcoding` `Open Connect` `surge pricing` → §12 ·
`estimation` `latency numbers` `powers of two` `back of envelope` `RPS` → §13 ·
`tradeoffs` `concurrency vs parallelism` `batch vs stream` `lambda architecture` `kappa` `stateful vs stateless` `push vs pull` `sync vs async` `strong vs eventual` → §14 ·
`rate limiter code` `load balancer code` `consistent hashing code` `pseudocode` `implementations` → §15 ·
`design problems` `practice list` `interview questions` → §16 ·
`papers` `Dynamo` `Bigtable` `GFS` `MapReduce` `Spanner` `Chubby` `ZooKeeper` `DDIA` `Kleppmann` `engineering blogs` → §17
