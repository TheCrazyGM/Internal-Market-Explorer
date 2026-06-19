import { Client } from '@srbde/pollen'

const FALLBACK_NODES = [
  'https://api.hive.blog',
  'https://api.openhive.network',
  'https://rpc.ecency.com',
]

const MAX_FAILURES = 3

interface PoolNode {
  url:      string
  client:   Client
  failures: number
  dead:     boolean
}

async function fetchNectarNodes(): Promise<string[]> {
  try {
    const bootstrap = new Client(FALLBACK_NODES)
    const [account] = await bootstrap.call<[{ json_metadata: string }]>(
      'condenser_api', 'get_accounts', [['nectarflower']]
    )
    const meta = JSON.parse(account.json_metadata) as { nodes: string[] }
    const nodes = meta.nodes ?? []
    return nodes.length ? nodes : FALLBACK_NODES
  } catch {
    return FALLBACK_NODES
  }
}

class NodePool {
  private pool: PoolNode[] = []
  private cursor = 0
  private initPromise: Promise<void> | null = null

  init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = fetchNectarNodes().then(urls => {
        this.pool = urls.map(url => ({
          url,
          client:   new Client([url]),
          failures: 0,
          dead:     false,
        }))
      })
    }
    return this.initPromise
  }

  private live(): PoolNode[] {
    return this.pool.filter(n => !n.dead)
  }

  private pick(exclude: Set<string>): PoolNode | null {
    const available = this.live().filter(n => !exclude.has(n.url))
    if (!available.length) return null
    const node = available[this.cursor % available.length]
    this.cursor++
    return node
  }

  async call<T>(api: string, method: string, params: unknown): Promise<T> {
    await this.init()
    const tried = new Set<string>()

    while (true) {
      const node = this.pick(tried)
      if (!node) throw new Error(`All nodes failed for ${api}.${method}`)
      tried.add(node.url)

      try {
        const result = await node.client.call<T>(api, method, params)
        if (node.failures > 0) node.failures--
        return result
      } catch (err) {
        node.failures++
        if (node.failures >= MAX_FAILURES) {
          node.dead = true
          console.warn(`[nodePool] dropped ${node.url} after ${MAX_FAILURES} failures`)
        }
        if (this.live().length === 0) throw new Error('No live nodes remaining')
      }
    }
  }

  get stats() {
    return {
      total: this.pool.length,
      live:  this.live().length,
      dead:  this.pool.filter(n => n.dead).length,
    }
  }
}

export const nodePool = new NodePool()
