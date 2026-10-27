import {readFile} from 'node:fs/promises'
import {parseOrders,campaignReport,forecast,experiment} from './metrics.mjs'
export * from './metrics.mjs'
export * from './lifecycle.mjs'
export async function report(root=new URL('./',import.meta.url)){
 const orders=parseOrders(await readFile(new URL('orders.csv',root),'utf8')),campaign=JSON.parse(await readFile(new URL('campaign.json',root),'utf8'))
 return{campaign:campaignReport(orders,campaign),experiment:experiment(campaign.experiment.control,campaign.experiment.treatment),forecast:forecast({spend:30000,cpc:100,leadRate:.1,qualifiedRate:.6,purchaseRate:.25,averageOrder:6500,grossMargin:.4})}
}
