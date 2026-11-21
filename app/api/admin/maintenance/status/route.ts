import {NextResponse} from "next/server";
import {requireAdmin} from "@/lib/server/adminAuth";
import {supabaseAdmin} from "@/lib/supabaseAdmin";
import {getMaintenanceSubscriptionStatus} from "@/lib/server/maintenanceSubscription";

export async function GET(request:Request){
  try{
    await requireAdmin(request);
    const {data:settings,error}=await supabaseAdmin.from("business_settings").select("admin_email").eq("id","main").maybeSingle();
    if(error) throw error;
    const email=String(settings?.admin_email||"sohocambados@gmail.com").trim().toLowerCase();
    const status=await getMaintenanceSubscriptionStatus(email);

    if(status.active){
      await supabaseAdmin.from("business_settings").update({
        monthly_hosting_fee:0,
        annual_domain_fee:0
      }).eq("id","main");
    }

    return NextResponse.json(status,{headers:{"Cache-Control":"no-store"}});
  }catch(error:any){
    const status=error?.message==="UNAUTHORIZED"?401:error?.message==="FORBIDDEN"?403:500;
    return NextResponse.json({error:status===500?"No se pudo consultar la suscripción.":"No autorizado."},{status});
  }
}
