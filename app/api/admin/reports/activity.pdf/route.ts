import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/adminAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import fs from 'node:fs';
import path from 'node:path';

function money(value: number) { return `${value.toFixed(2).replace('.', ',')} EUR`; }
function clean(value: unknown) { return String(value ?? '').replace(/[\u2013\u2014]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[^\x20-\xFF]/g, '?'); }
function esc(value: unknown) { return clean(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); }
function statusLabel(status: string) { return ({ pending: 'Pendiente', accepted: 'Aceptado', preparing: 'Preparando', ready: 'Listo', delivered: 'Entregado', cancelled: 'Cancelado' } as Record<string,string>)[status] || 'Pendiente'; }
function paymentLabel(status: string) { return ({ pending: 'Pendiente', authorized: 'Autorizado', paid: 'Pagado', failed: 'Fallido', cancelled: 'Liberado', refund_pending: 'Reembolso pendiente', refunded: 'Reembolsado' } as Record<string,string>)[status] || 'Pendiente'; }

class SohoPdf {
  pages: string[][] = [[]];
  page = 0;
  y = 805;
  activeTableCols: { label: string; x: number; w: number }[] | null = null;
  logo = fs.readFileSync(path.join(process.cwd(), 'public', 'soho-logo-report.jpg'));

  addPage(repeatTableHeader = false) {
    this.pages.push([]);
    this.page += 1;
    this.y = 805;
    if (repeatTableHeader && this.activeTableCols) this.drawTableHeader(this.activeTableCols);
  }
  op(value: string) { this.pages[this.page].push(value); }
  color(hex: string, stroke = false) {
    const n = hex.replace('#',''); const r=parseInt(n.slice(0,2),16)/255; const g=parseInt(n.slice(2,4),16)/255; const b=parseInt(n.slice(4,6),16)/255;
    return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} ${stroke ? 'RG' : 'rg'}`;
  }
  rect(x:number,y:number,w:number,h:number,fill:string,stroke?:string,radius=0) {
    this.op('q'); this.op(this.color(fill)); if(stroke){this.op(this.color(stroke,true)); this.op('0.8 w');}
    if(radius<=0){this.op(`${x} ${y} ${w} ${h} re ${stroke?'B':'f'}`);} else {
      const r=Math.min(radius,w/2,h/2), k=0.55228475*r;
      this.op(`${x+r} ${y} m ${x+w-r} ${y} l ${x+w-r+k} ${y} ${x+w} ${y+r-k} ${x+w} ${y+r} c ${x+w} ${y+h-r} l ${x+w} ${y+h-r+k} ${x+w-r+k} ${y+h} ${x+w-r} ${y+h} c ${x+r} ${y+h} l ${x+r-k} ${y+h} ${x} ${y+h-r+k} ${x} ${y+h-r} c ${x} ${y+r} l ${x} ${y+r-k} ${x+r-k} ${y} ${x+r} ${y} c ${stroke?'B':'f'}`);
    }
    this.op('Q');
  }
  image(x:number,y:number,w:number,h:number){this.op(`q ${w} 0 0 ${h} ${x} ${y} cm /Logo Do Q`);}
  text(value:string,x:number,y:number,size=10,bold=false,color='#111111',maxChars?:number){
    const text=maxChars ? clean(value).slice(0,maxChars) : clean(value);
    this.op(`BT ${this.color(color)} /${bold?'F2':'F1'} ${size} Tf ${x} ${y} Td (${esc(text)}) Tj ET`);
  }
  line(x1:number,y1:number,x2:number,y2:number,color='#e5e7eb',width=0.8){this.op(`q ${this.color(color,true)} ${width} w ${x1} ${y1} m ${x2} ${y2} l S Q`);}
  header(){
    this.rect(28,755,539,58,'#fff7ed','#fed7aa',14);
    this.image(40,761,48,48);
    this.text('INFORME DE ACTIVIDAD WEB',108,790,12.5,true,'#111111');
    this.text('Y RESUMEN FISCAL',108,774,12.5,true,'#111111');
    this.text('Documento para apoyo administrativo y contable',330,775,7.5,false,'#64748b');
    this.y=735;
  }
  ensure(height:number, repeatTableHeader=false){if(this.y-height<48)this.addPage(repeatTableHeader);}
  section(title:string){
    this.activeTableCols=null;
    this.ensure(46);
    this.y-=10;
    this.text(title,42,this.y,12,true,'#111111');
    this.line(42,this.y-7,553,this.y-7,'#fdba74',1);
    this.y-=32;
  }
  drawTableHeader(cols:{label:string,x:number,w:number}[]){
    this.rect(42,this.y-20,511,23,'#fff7ed','#fed7aa',5);
    cols.forEach(c=>this.text(c.label,c.x,this.y-12,7.5,true,'#7c2d12'));
    this.y-=24;
  }
  tableHeader(cols:{label:string,x:number,w:number}[]){this.ensure(28);this.activeTableCols=cols;this.drawTableHeader(cols);}
  tableRow(values:{text:string,x:number,w:number}[],highlight=false){
    this.ensure(22,true);
    if(highlight)this.rect(42,this.y-16,511,20,'#f8fafc');
    values.forEach(v=>this.text(v.text,v.x,this.y-10,7,false,'#334155',Math.max(4,Math.floor(v.w/4.2))));
    this.line(42,this.y-18,553,this.y-18,'#e5e7eb',0.5);this.y-=20;
  }
  endTable(){this.activeTableCols=null;this.y-=10;}
  metric(x:number,label:string,value:string,accent:string){this.rect(x,this.y-56,120,55,'#ffffff',accent,10);this.text(label,x+12,this.y-20,7.5,true,'#64748b');this.text(value,x+12,this.y-43,17,true,'#111111');}
  build(){
    const totalPages=this.pages.length;
    this.pages.forEach((ops,index)=>ops.push(`BT ${this.color('#64748b')} /F1 7 Tf 500 24 Td (Pagina ${index+1} de ${totalPages}) Tj ET`));
    const objects:string[]=[]; const add=(body:string)=>{objects.push(body);return objects.length;};
    const font1=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const font2=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const logoBody=`<< /Type /XObject /Subtype /Image /Width 725 /Height 725 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${this.logo.length} >>\nstream\n${this.logo.toString('latin1')}\nendstream`;
    const logoId=add(logoBody);
    const contentIds=this.pages.map(ops=>{const stream=ops.join('\n');return add(`<< /Length ${Buffer.byteLength(stream,'latin1')} >>\nstream\n${stream}\nendstream`);});
    const pagesId=objects.length+this.pages.length+1; const pageIds:number[]=[];
    this.pages.forEach((_,i)=>pageIds.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >> /XObject << /Logo ${logoId} 0 R >> >> /Contents ${contentIds[i]} 0 R >>`)));
    add(`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`); const catalogId=add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
    let pdf='%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'; const offsets=[0]; objects.forEach((obj,i)=>{offsets.push(Buffer.byteLength(pdf,'latin1'));pdf+=`${i+1} 0 obj\n${obj}\nendobj\n`;});
    const xref=Buffer.byteLength(pdf,'latin1'); pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`; for(let i=1;i<=objects.length;i++)pdf+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;
    pdf+=`trailer\n<< /Size ${objects.length+1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`; return Buffer.from(pdf,'latin1');
  }
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const url=new URL(request.url); const from=url.searchParams.get('from'); const to=url.searchParams.get('to');
    if(!from||!to)return NextResponse.json({error:'Periodo no valido.'},{status:400});
    const fromDate=new Date(`${from}T00:00:00`),toDate=new Date(`${to}T23:59:59.999`);
    if(Number.isNaN(fromDate.getTime())||Number.isNaN(toDate.getTime())||toDate<fromDate)return NextResponse.json({error:'Periodo no valido.'},{status:400});
    if(toDate.getTime()-fromDate.getTime()>366*86400000)return NextResponse.json({error:'El informe permite un maximo de un ano.'},{status:400});

    const [{data:orders,error},{data:settings}]=await Promise.all([
      supabaseAdmin.from('orders').select('id,created_at,order_type,status,payment_status,total_price,stripe_fee_amount,refunded_amount,refund_reason,order_items(product_name,quantity,total_price,vat_rate)').gte('created_at',fromDate.toISOString()).lte('created_at',toDate.toISOString()).order('created_at'),
      supabaseAdmin.from('business_settings').select('*').eq('id','main').maybeSingle()
    ]);
    if(error)throw error;
    const list=orders||[];
    const cancelled=list.filter((o:any)=>o.status==='cancelled');
    const captured=list.filter((o:any)=>o.status!=='cancelled'&&['paid','refund_pending','refunded'].includes(o.payment_status));
    const refundsPending=list.filter((o:any)=>o.payment_status==='refund_pending');
    const refundsCompleted=list.filter((o:any)=>o.payment_status==='refunded');
    const grossSales=captured.reduce((sum:number,o:any)=>sum+Number(o.total_price||0),0);
    const refundedTotal=refundsCompleted.reduce((sum:number,o:any)=>sum+Math.min(Number(o.total_price||0),Number(o.refunded_amount??o.total_price??0)),0);
    const netSales=Number((grossSales-refundedTotal).toFixed(2));

    type VatTotals={base:number;vat:number;total:number};
    const grossVatMap=new Map<number,VatTotals>();
    const refundVatMap=new Map<number,VatTotals>();
    const addVat=(map:Map<number,VatTotals>,rate:number,total:number)=>{const base=total/(1+rate/100),vat=total-base,current=map.get(rate)||{base:0,vat:0,total:0};current.base+=base;current.vat+=vat;current.total+=total;map.set(rate,current);};
    captured.forEach((o:any)=>{
      const orderTotal=Math.max(0,Number(o.total_price||0));
      const refundAmount=o.payment_status==='refunded'?Math.min(orderTotal,Number(o.refunded_amount??orderTotal)):0;
      const refundRatio=orderTotal>0?refundAmount/orderTotal:0;
      o.order_items?.forEach((i:any)=>{
        const rate=Number(i.vat_rate||10),itemTotal=Number(i.total_price||0);
        addVat(grossVatMap,rate,itemTotal);
        if(refundRatio>0)addVat(refundVatMap,rate,itemTotal*refundRatio);
      });
    });
    const stripeFees=captured.reduce((s:number,o:any)=>s+Number(o.stripe_fee_amount||0),0),tickets=captured.length;
    const printer=tickets*Number(settings?.printer_price_per_ticket||0); const start=settings?.service_start_date?new Date(`${settings.service_start_date}T00:00:00`):null;
    const free=!start||toDate<new Date(new Date(start).setMonth(start.getMonth()+3));
    const management=free?0:Number(settings?.monthly_management_fee||0),hosting=free?0:Number(settings?.monthly_hosting_fee||0),domain=free?0:Number(settings?.annual_domain_fee||0)/12;
    const costs=stripeFees+printer+management+hosting+domain;

    const pdf=new SohoPdf(); pdf.header();
    pdf.rect(42,pdf.y-70,511,66,'#ffffff','#e5e7eb',10);
    pdf.text(`Periodo: ${from} - ${to}`,58,pdf.y-20,9,true,'#111111');
    pdf.text(`Generado: ${new Date().toLocaleString('es-ES',{timeZone:'Europe/Madrid'})}`,58,pdf.y-38,8,false,'#475569');
    pdf.text(`Titular: ${settings?.fiscal_name||'SOHO Cambados'}`,285,pdf.y-20,9,true,'#111111');
    pdf.text(`NIF/CIF: ${settings?.fiscal_nif||'Pendiente de configurar'}`,285,pdf.y-38,8,false,'#475569');
    pdf.text(`Direccion fiscal: ${settings?.fiscal_address||'Pendiente de configurar'}`,58,pdf.y-55,8,false,'#475569',62);
    pdf.y-=88;

    pdf.section('1. RESUMEN DEL PERIODO');
    pdf.metric(42,'Pedidos creados',String(list.length),'#bfdbfe'); pdf.metric(174,'Ventas cobradas',String(captured.length),'#bbf7d0'); pdf.metric(306,'Reembolsados',String(refundsCompleted.length),'#fecdd3'); pdf.metric(438,'Ventas netas',money(netSales),'#fdba74'); pdf.y-=72;

    pdf.section('2. RELACION DE PEDIDOS DE LA WEB');
    const cols=[{label:'Referencia',x:50,w:72},{label:'Fecha y hora',x:126,w:105},{label:'Estado',x:235,w:74},{label:'Pago',x:313,w:83},{label:'Art.',x:400,w:35},{label:'Total',x:444,w:100}];
    pdf.tableHeader(cols);
    list.forEach((o:any,index:number)=>{const count=o.order_items?.reduce((s:number,i:any)=>s+Number(i.quantity||0),0)||0;pdf.tableRow([
      {text:`WEB-${String(o.id).slice(0,8).toUpperCase()}`,x:50,w:72},{text:new Date(o.created_at).toLocaleString('es-ES',{timeZone:'Europe/Madrid'}),x:126,w:105},
      {text:statusLabel(o.status),x:235,w:74},{text:paymentLabel(o.payment_status),x:313,w:83},{text:String(count),x:400,w:35},{text:money(Number(o.total_price||0)),x:444,w:100}
    ],index%2===1);});
    pdf.endTable();

    pdf.section('3. DESGLOSE FISCAL DEL PERIODO');
    pdf.tableHeader([{label:'Tipo IVA',x:50,w:72},{label:'Concepto',x:126,w:120},{label:'Base imponible',x:250,w:105},{label:'Cuota IVA',x:360,w:85},{label:'Total',x:450,w:90}]);
    let grossBaseTotal=0,grossVatTotal=0,refundBaseTotal=0,refundVatTotal=0;
    const rates=[...new Set([...grossVatMap.keys(),...refundVatMap.keys()])].sort((a,b)=>a-b);
    let fiscalRow=0;
    rates.forEach((rate)=>{
      const gross=grossVatMap.get(rate)||{base:0,vat:0,total:0};
      const refund=refundVatMap.get(rate)||{base:0,vat:0,total:0};
      const net={base:gross.base-refund.base,vat:gross.vat-refund.vat,total:gross.total-refund.total};
      grossBaseTotal+=gross.base;grossVatTotal+=gross.vat;refundBaseTotal+=refund.base;refundVatTotal+=refund.vat;
      pdf.tableRow([{text:`${rate}%`,x:50,w:72},{text:'Ventas brutas',x:126,w:120},{text:money(gross.base),x:250,w:105},{text:money(gross.vat),x:360,w:85},{text:money(gross.total),x:450,w:90}],fiscalRow++%2===1);
      if(refund.total>0)pdf.tableRow([{text:`${rate}%`,x:50,w:72},{text:'Reembolsos',x:126,w:120},{text:`-${money(refund.base)}`,x:250,w:105},{text:`-${money(refund.vat)}`,x:360,w:85},{text:`-${money(refund.total)}`,x:450,w:90}],fiscalRow++%2===1);
      pdf.tableRow([{text:`${rate}%`,x:50,w:72},{text:'Neto',x:126,w:120},{text:money(net.base),x:250,w:105},{text:money(net.vat),x:360,w:85},{text:money(net.total),x:450,w:90}],true);
    });
    pdf.tableRow([{text:'TOTAL',x:50,w:72},{text:'Ventas brutas',x:126,w:120},{text:money(grossBaseTotal),x:250,w:105},{text:money(grossVatTotal),x:360,w:85},{text:money(grossSales),x:450,w:90}],true);
    if(refundedTotal>0)pdf.tableRow([{text:'TOTAL',x:50,w:72},{text:'Reembolsos',x:126,w:120},{text:`-${money(refundBaseTotal)}`,x:250,w:105},{text:`-${money(refundVatTotal)}`,x:360,w:85},{text:`-${money(refundedTotal)}`,x:450,w:90}],true);
    pdf.tableRow([{text:'TOTAL',x:50,w:72},{text:'VENTA NETA',x:126,w:120},{text:money(grossBaseTotal-refundBaseTotal),x:250,w:105},{text:money(grossVatTotal-refundVatTotal),x:360,w:85},{text:money(netSales),x:450,w:90}],true);
    pdf.endTable();

    if(cancelled.length||refundsCompleted.length||refundsPending.length){
      pdf.section('4. CANCELACIONES Y REEMBOLSOS EXCEPCIONALES');
      pdf.text(`Pedidos cancelados: ${cancelled.length} | Reembolsos completados: ${refundsCompleted.length} | Pendientes: ${refundsPending.length}`,50,pdf.y,9,true,'#9f1239');pdf.y-=18;
      refundsCompleted.forEach((o:any)=>{const amount=Math.min(Number(o.total_price||0),Number(o.refunded_amount??o.total_price??0));pdf.text(`${`WEB-${String(o.id).slice(0,8).toUpperCase()}`} - Reembolsado - -${money(amount)}${o.refund_reason?` - ${o.refund_reason}`:''}`,50,pdf.y,7,false,'#475569',90);pdf.y-=14;});
      refundsPending.forEach((o:any)=>{pdf.text(`${`WEB-${String(o.id).slice(0,8).toUpperCase()}`} - Reembolso pendiente (sin descontar) - ${money(Number(o.total_price||0))}${o.refund_reason?` - ${o.refund_reason}`:''}`,50,pdf.y,7,false,'#92400e',90);pdf.y-=14;});
      pdf.y-=12;
    }

    pdf.section('5. GASTOS OPERATIVOS DEL CANAL WEB');
    pdf.tableHeader([{label:'Concepto',x:50,w:130},{label:'Calculo',x:185,w:245},{label:'Importe',x:435,w:105}]);
    const rows=[['Comision Stripe','Comisiones reales registradas',money(stripeFees)],['Servicio impresora',`${tickets} tickets x ${money(Number(settings?.printer_price_per_ticket||0))}`,money(printer)],['Gestion',free?'Gratuito durante los 3 primeros meses':'Cuota mensual configurada',money(management)],['Hosting',free?'Gratuito durante los 3 primeros meses':'Cuota mensual configurada',money(hosting)],['Dominio',free?'Gratuito durante los 3 primeros meses':'Prorrateo mensual del coste anual',money(domain)]];
    rows.forEach((r,index)=>pdf.tableRow([{text:r[0],x:50,w:130},{text:r[1],x:185,w:245},{text:r[2],x:435,w:105}],index%2===1));
    pdf.tableRow([{text:'TOTAL GASTOS',x:50,w:130},{text:'',x:185,w:245},{text:money(costs),x:435,w:105}],true);
    pdf.endTable();

    pdf.section('6. RESULTADO OPERATIVO DEL PERIODO');
    pdf.rect(42,pdf.y-70,511,64,'#ecfdf5','#86efac',12);
    pdf.text('Ventas netas (IVA incluido)',58,pdf.y-24,8,true,'#166534'); pdf.text(money(netSales),58,pdf.y-48,16,true,'#111111');
    pdf.text('Menos gastos operativos',230,pdf.y-24,8,true,'#166534'); pdf.text(money(costs),230,pdf.y-48,16,true,'#111111');
    pdf.text('Neto operativo',405,pdf.y-24,8,true,'#166534'); pdf.text(money(netSales-costs),405,pdf.y-48,16,true,'#15803d');
    pdf.y-=88;
    pdf.text('Documento informativo generado por la web de SOHO Cambados para apoyo administrativo y contable.',42,pdf.y,7.5,false,'#64748b');pdf.y-=13;
    pdf.text('No sustituye a tickets, facturas ni justificantes fiscales oficiales. La gestoría debe validar el tratamiento fiscal definitivo.',42,pdf.y,7.5,false,'#64748b');

    const buffer=pdf.build();
    return new NextResponse(buffer,{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="informe-soho-${from}-${to}.pdf"`,'Cache-Control':'no-store'}});
  } catch(error:any){const status=error?.message==='UNAUTHORIZED'?401:error?.message==='FORBIDDEN'?403:500;return NextResponse.json({error:status===500?(error?.message||'No se pudo generar el informe.'):'No autorizado.'},{status});}
}
