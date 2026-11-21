export type MaintenanceSubscriptionStatus={
  active:boolean;
  status:string;
  plan:{name:string;slug:string}|null;
  amountMinor:number;
  currency:string;
  billingInterval:string|null;
  currentPeriodEnd:string|null;
};

export async function getMaintenanceSubscriptionStatus(email:string):Promise<MaintenanceSubscriptionStatus>{
  const secret=process.env.MAINTENANCE_STATUS_SECRET?.trim();
  if(!secret) return {active:false,status:"unknown",plan:null,amountMinor:0,currency:"EUR",billingInterval:null,currentPeriodEnd:null};

  const response=await fetch("https://suscripciones.girma.es/api/internal/maintenance-status",{
    method:"POST",
    headers:{"Content-Type":"application/json",Authorization:`Bearer ${secret}`},
    body:JSON.stringify({email}),
    cache:"no-store"
  });

  if(!response.ok) throw new Error(`MAINTENANCE_STATUS_HTTP_${response.status}`);
  const data=await response.json() as MaintenanceSubscriptionStatus;
  return {
    active:Boolean(data.active),
    status:String(data.status||"none"),
    plan:data.plan||null,
    amountMinor:Number(data.amountMinor||0),
    currency:String(data.currency||"EUR"),
    billingInterval:data.billingInterval||null,
    currentPeriodEnd:data.currentPeriodEnd||null
  };
}
