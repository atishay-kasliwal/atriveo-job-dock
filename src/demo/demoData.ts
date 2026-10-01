import type { ApiJob } from '@/api/jobMapper'

// Every company here is fictional and every link points at example.com, so
// the public demo never passes off invented postings as a real employer's.

interface Seed {
  company: string
  title: string
  location: string
  score: number
  level: string
  term: string
  summary: string
}

const SEEDS: Seed[] = [
  { company: 'Northwind Labs', title: 'Software Engineer, Platform', location: 'New York, NY', score: 94, level: 'Entry', term: 'software engineer', summary: 'Build the internal platform that ships 400 deploys a day: Go and TypeScript services, Kafka, and Kubernetes on AWS.' },
  { company: 'Lumen AI', title: 'Machine Learning Engineer', location: 'San Francisco, CA', score: 91, level: 'Entry', term: 'ML engineer', summary: 'Train and serve retrieval models behind a RAG product used by 2M people. Python, PyTorch, and GPU inference.' },
  { company: 'Cobalt Pay', title: 'Backend Engineer, Payments', location: 'Remote - US', score: 88, level: 'Mid', term: 'backend engineer', summary: 'Own ledger and reconciliation services in Java and Spring Boot with strict latency and correctness targets.' },
  { company: 'Meridian Cloud', title: 'Site Reliability Engineer', location: 'Seattle, WA', score: 83, level: 'Mid', term: 'software engineer', summary: 'Keep a multi-region storage service at 99.99% while cutting on-call pages with better observability.' },
  { company: 'Sable Analytics', title: 'Data Engineer', location: 'Chicago, IL', score: 79, level: 'Entry', term: 'data scientist', summary: 'Design streaming ETL on Spark and Airflow that feeds dashboards for 300 enterprise customers.' },
  { company: 'Helix Health', title: 'Full Stack Engineer', location: 'Boston, MA', score: 76, level: 'Entry', term: 'new grad', summary: 'Ship clinician-facing React features backed by FastAPI and Postgres in a HIPAA-regulated product.' },
  { company: 'Quanta Robotics', title: 'Software Engineer, Autonomy', location: 'Pittsburgh, PA', score: 72, level: 'Mid', term: 'software engineer', summary: 'Write the C++ and Python tooling that turns fleet logs into simulation scenarios for autonomy testing.' },
  { company: 'Nimbus Search', title: 'AI Engineer, Agents', location: '', score: 69, level: 'Entry', term: 'AI engineer', summary: 'Prototype tool-using agents, evaluate them rigorously, and harden the winners for production traffic.' },
  { company: 'Brightline Security', title: 'Software Engineer, Detection', location: 'Austin, TX', score: 66, level: 'Entry', term: 'backend engineer', summary: 'Build detection pipelines over billions of security events a day using Rust, Kafka, and ClickHouse.' },
  { company: 'Polaris Maps', title: 'Frontend Engineer', location: 'Remote - US', score: 61, level: 'Mid', term: 'software engineer', summary: 'Own the WebGL map renderer and the React app around it, with a sharp eye on frame times.' },
  { company: 'Harbor Fintech', title: 'Software Engineer, New Grad 2027', location: 'Jersey City, NJ', score: 87, level: 'New Grad', term: 'new grad', summary: 'Rotate across trading, risk and data teams building low-latency services in Java and Python.' },
  { company: 'Orbital Data', title: 'Backend Engineer', location: 'Denver, CO', score: 81, level: 'Entry', term: 'backend engineer', summary: 'Scale the ingestion API from 50K to 500K events per second without losing ordering guarantees.' },
  { company: 'Juniper Bio', title: 'Machine Learning Engineer, Proteins', location: 'South San Francisco, CA', score: 74, level: 'Mid', term: 'ML engineer', summary: 'Productionize protein language models and the evaluation harness scientists rely on.' },
  { company: 'Kestrel Mobility', title: 'Platform Engineer', location: 'Los Angeles, CA', score: 64, level: 'Mid', term: 'software engineer', summary: 'Run Terraform-managed infrastructure and CI/CD for 80 engineers shipping a rideshare app.' },
  { company: 'Ember Labs', title: 'Software Engineer Intern, Summer 2027', location: 'New York, NY', score: 58, level: 'Entry', term: 'software engineer', summary: 'Twelve weeks on a product team shipping real features, with a mentor and a demo day.' },
  { company: 'Aurora Games', title: 'Gameplay Engineer', location: 'Irvine, CA', score: 47, level: 'Mid', term: 'software engineer', summary: 'Implement gameplay systems in C++ for a live multiplayer title with 5M monthly players.' },
  { company: 'Redwood Commerce', title: 'Software Engineer II', location: 'Remote - US', score: 85, level: 'Mid', term: 'backend engineer', summary: 'Modernize checkout on microservices with Node.js, GraphQL and DynamoDB during peak traffic.' },
  { company: 'Tidewater Energy', title: 'Data Scientist, Forecasting', location: 'Houston, TX', score: 71, level: 'Entry', term: 'data scientist', summary: 'Forecast grid demand with time-series models and ship them behind reliable APIs.' },
  { company: 'Vector Freight', title: 'Full Stack Engineer', location: 'Atlanta, GA', score: 63, level: 'Entry', term: 'new grad', summary: 'Build the shipper dashboard in React and the TypeScript services that price freight in real time.' },
  { company: 'Pinecrest Systems', title: 'Embedded Software Engineer', location: 'Raleigh, NC', score: 38, level: 'Mid', term: 'software engineer', summary: 'Write firmware for industrial sensors in C with tight power and memory budgets.' },
  { company: 'Lumen AI', title: 'Software Engineer, Inference', location: 'San Francisco, CA', score: 89, level: 'Mid', term: 'AI engineer', summary: 'Squeeze latency out of the model-serving stack: batching, caching and CUDA kernels.' },
  { company: 'Northwind Labs', title: 'Data Engineer', location: 'New York, NY', score: 77, level: 'Entry', term: 'data scientist', summary: 'Own the warehouse models that finance and growth teams run the company on.' },
  { company: 'Meridian Cloud', title: 'Backend Engineer, Storage', location: 'Seattle, WA', score: 82, level: 'Mid', term: 'backend engineer', summary: 'Build the metadata layer of an object store holding 40 PB across three regions.' },
  { company: 'Cobalt Pay', title: 'Machine Learning Engineer, Risk', location: 'Remote - US', score: 86, level: 'Mid', term: 'ML engineer', summary: 'Ship fraud models that decide in under 50 ms, with the monitoring to prove they still work.' },
]

/** Scraped later by the simulated run, so the feed visibly grows. */
export const DEMO_FRESH_SEEDS: Seed[] = [
  { company: 'Solstice Robotics', title: 'Software Engineer, Perception', location: 'Boston, MA', score: 90, level: 'Entry', term: 'software engineer', summary: 'Build the perception pipeline for warehouse robots: C++, CUDA and a lot of real-world data.' },
  { company: 'Granite Health', title: 'Backend Engineer', location: 'Nashville, TN', score: 84, level: 'Entry', term: 'backend engineer', summary: 'Design FHIR-compliant APIs in Python that move patient records between 900 clinics.' },
  { company: 'Atlas Learning', title: 'Full Stack Engineer, New Grad', location: 'Remote - US', score: 80, level: 'New Grad', term: 'new grad', summary: 'Ship features end to end in a Next.js and Postgres product used by 3M students.' },
  { company: 'Cascade Networks', title: 'Site Reliability Engineer', location: 'Portland, OR', score: 73, level: 'Mid', term: 'software engineer', summary: 'Automate away toil across a global edge network and own incident response tooling.' },
  { company: 'Fable Studios', title: 'Machine Learning Engineer, Recommendations', location: 'Los Angeles, CA', score: 78, level: 'Mid', term: 'ML engineer', summary: 'Improve ranking and recommendations for a streaming catalog of 20K titles.' },
  { company: 'Onyx Capital', title: 'Software Engineer, Trading Systems', location: 'Chicago, IL', score: 68, level: 'Entry', term: 'software engineer', summary: 'Build low-latency order routing in C++ and the Python tools that monitor it.' },
]

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function demoJob(seed: Seed, sessionAt: Date): ApiJob {
  const iso = sessionAt.toISOString().replace(/\.\d{3}Z$/, 'Z')
  return {
    job_url: `https://jobs.example.com/${slug(seed.company)}/${slug(seed.title)}`,
    session_id: iso,
    batch_time: iso,
    company: seed.company,
    title: seed.title,
    location: seed.location,
    level: seed.level,
    score: seed.score * 3,
    score_pct: seed.score,
    summary: seed.summary,
    search_term: seed.term,
    site: 'demo',
    date_posted: iso.slice(0, 10),
    min_exp: 0,
    max_exp: 3,
    pipeline: 'standard',
  }
}

/** Scrape sessions spread across the last week, newest first. */
export function buildDemoFeed(now = Date.now()): ApiJob[] {
  const at = (minutesAgo: number) => new Date(now - minutesAgo * 60_000)
  const sessions: [number, number, number][] = [
    // [minutes ago, first seed, seed count]
    [6, 0, 10],
    [66, 10, 5],
    [126, 15, 3],
    [60 * 24 + 30, 18, 3],
    [60 * 24 * 3, 21, 3],
  ]
  return sessions.flatMap(([ago, from, count]) =>
    SEEDS.slice(from, from + count).map((s) => demoJob(s, at(ago))))
}
