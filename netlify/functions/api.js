const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers = {'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const reply=(status,data)=>({statusCode:status,headers,body:JSON.stringify(data)});
const MAX=1024*200;
const validText=(v,max=1000)=>typeof v==='string'&&v.length<=max;
async function db(path,method='GET',body,extra={}) {
 const res=await fetch(`${URL}/rest/v1/${path}`,{method,headers:{apikey:KEY,Authorization:`Bearer ${KEY}`,'Content-Type':'application/json',Prefer:'return=representation',...extra},body:body===undefined?undefined:JSON.stringify(body)});
 const txt=await res.text(); let data;try{data=txt?JSON.parse(txt):null}catch{data={message:'Unexpected database response'}};
 if(!res.ok){const e=new Error(data?.code==='23505'?'這個單字已經存在。':(data?.message||'Database error'));e.status=res.status;throw e}return data;
}
exports.handler=async(event)=>{
 if(!URL||!KEY)return reply(503,{error:'尚未設定 Supabase 環境變數。'});
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(URL))return reply(503,{error:'Supabase URL 格式不正確。'});
 const method=event.httpMethod;
 if(method==='OPTIONS')return {statusCode:204,headers,body:''};
 if(!['GET','POST','PATCH','DELETE'].includes(method))return reply(405,{error:'不支援的操作'});
 if((event.body||'').length>MAX)return reply(413,{error:'請求資料太大'});
 let data={};try{if(event.body)data=JSON.parse(event.body)}catch{return reply(400,{error:'JSON 格式錯誤'})}
 const action=event.queryStringParameters?.action||'words';
 try{
  if(action==='words'){
   if(method==='GET')return reply(200,{words:await db('mvb_public_words?select=*&order=created_at.desc&limit=3000')});
   if(method==='POST'||method==='PATCH'){
    if(!validText(data.word,120)||!data.word.trim()||!validText(data.meaning_zh,500)||!data.meaning_zh.trim()||!validText(data.example_en,1500)||!validText(data.example_zh,1500)||!validText(data.part_of_speech,80)||!validText(data.category,120)||!validText(data.definition_en,1000))return reply(400,{error:'請確認單字、中文解釋及其他欄位格式。'});
    const payload={word:data.word.trim(),meaning_zh:data.meaning_zh.trim(),example_en:data.example_en.trim(),example_zh:data.example_zh.trim(),part_of_speech:data.part_of_speech.trim(),category:data.category.trim(),definition_en:data.definition_en.trim()};
    if(method==='POST')return reply(201,{word:(await db('mvb_public_words','POST',payload))[0]});
    if(!/^[0-9a-f-]{36}$/i.test(data.id||''))return reply(400,{error:'無效的單字 ID'});
    const rows=await db(`mvb_public_words?id=eq.${encodeURIComponent(data.id)}`,'PATCH',payload);
    return rows.length?reply(200,{word:rows[0]}):reply(404,{error:'找不到單字'});
   }
   if(method==='DELETE'){
    if(!/^[0-9a-f-]{36}$/i.test(data.id||''))return reply(400,{error:'無效的單字 ID'});
    const rows=await db(`mvb_public_words?id=eq.${encodeURIComponent(data.id)}`,'DELETE');return rows.length?reply(200,{ok:true}):reply(404,{error:'找不到單字'});
   }
  }
  if(action==='attempts'){
   if(method==='GET')return reply(200,{attempts:await db('mvb_public_attempts?select=*&order=created_at.desc&limit=3000')});
   if(method==='POST'){
    if(!/^[0-9a-f-]{36}$/i.test(data.word_id||'')||typeof data.correct!=='boolean'||!validText(data.answer,500)||!validText(data.question,1000))return reply(400,{error:'測驗紀錄格式不正確'});
    return reply(201,{attempt:(await db('mvb_public_attempts','POST',{word_id:data.word_id,correct:data.correct,answer:data.answer,question:data.question}))[0]});
   }
  }
  return reply(405,{error:'不支援的操作'});
 }catch(e){console.error('API error',e.status||500,e.message);return reply(e.status===409?409:e.status===400?400:500,{error:e.message||'伺服器錯誤'})}
};
