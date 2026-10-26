import {newsTelegramPost} from './news.ts'
export async function refreshNewsMessage(telegram: (method:string,payload:Record<string,unknown>)=>Promise<any>, chat:number,message:number,lesson:any,bot:any){
 const post=newsTelegramPost(lesson,bot)
 const common={chat_id:chat,message_id:message,reply_markup:{inline_keyboard:[[{text:'Читать полностью',url:post.link}]]}}
 let r=lesson.cover_url
  ? await telegram('editMessageMedia',{...common,media:{type:'photo',media:lesson.cover_url,caption:post.text,parse_mode:'HTML'}})
  : await telegram('editMessageCaption',{...common,caption:post.text,parse_mode:'HTML'})
 if(lesson.cover_url&&!r.ok&&r.error_code===400&&!String(r.description).includes('message is not modified'))r=await telegram('editMessageCaption',{...common,caption:post.text,parse_mode:'HTML'})
 if(!r.ok&&r.error_code===400&&!String(r.description).includes('message is not modified'))r=await telegram('editMessageText',{...common,text:post.text,parse_mode:'HTML',link_preview_options:{is_disabled:true}})
 return r.ok||String(r.description).includes('message is not modified')?{ok:true}:{ok:false,error:`telegram_${r.error_code??'rejected'}`}
}
