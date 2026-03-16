import re

file_path = "src/hooks/useGameState.ts"
with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

new_func = """function generateAgentLogs(
  profile: PlayerProfile,
  templeName: string,
  templeId: number,
  templeItemsCollected: number[],
  startLogId: number
): {
  entries: ActivityEntry[];
  incenseCoinDelta: number;
  meritDelta: number;
  newSGradeItems: string[];
  newTempleItemIds: number[];
} {
  const weights = TRAINING_WEIGHTS[profile.trainingStyle];
  const friendProb = PERSONALITY_FRIEND_PROB[profile.personality];
  const count = 4 + Math.floor(Math.random() * 3); // 4, 5, 或 6

  // 动态生成未来时间（以当前时间为基准，每次间隔 45~120 分钟）
  let baseTime = new Date();
  const times: string[] = [];
  for (let i = 0; i < count; i++) {
    const minsToAdd = 45 + Math.floor(Math.random() * 75);
    baseTime = new Date(baseTime.getTime() + minsToAdd * 60000);
    times.push(`${String(baseTime.getHours()).padStart(2, "import re

file_path = "src/hote
file_paStawith open(file_path, 'r', encoding='utct    text = f.read()

new_func = """function generi
new_func = """funt n  profile: PlayerProfile,
  templeName: wT  templeName: string,
  eI  templeId: number,
t   templeItemsColle;
  startLogId: number
): {
  entr  ): {
  entries: Actti  e)   incenseCoinDelta: numbergh  meritDelta: number;
  ne??  newSGradeItems: st?? newTempleItemIds: number
 } {
  const weights = TRAINI&   th  const friendProb = PERSONALITY_FRIEND_PROB[profile.pers
   const count = 4 + Math.floor(Math.random() * 3); // 4, 5, 或 6";
  // 动态生成未来时间（以当前时间为基准，每?;  let baseTime = new Date();
  const times: string[] = [];
  for (let i = 0; i < coun      icon = "📖";
        desc  for (let i = 0; i < count;?   const minsToAdd = 45 + Math.fl?   baseTime = new Date(baseTime.getTime() + minsToAdd * _D    times.push(`${String(baseTime.getHours()).padStart(2, "impon 
file_path = "src/hote
file_paStawith open(file_path, 'r', encodingconfile_paStawith open( M
new_func = """function generi
new_func = """funt n  profile: Player   new_func = """funt n  profilpp  templeName: wT  templeName: string,
  eI  ??  eI  templeId: number,
t   templeIt  t   (!newTempleItemIds.i  startLogId: number M): {
  entr  ): _GRAD  eRO  entries: 
   ne??  newSGradeItems: st?? newTempleItemIds: number
 } {
  const wms } {
  const weights = TRAINI&   th  const friendProb);  c     const count = 4 + Math.floor(Math.random() * 3); // 4, 5, 或 6";
  // 动态生成br  // 动态生成未来时间（以当前时间为基准，每?; co  const times: string[] = [];
  for (let i = 0; i < coun      icon = "📖";
        desc  fo);  for (let i = 0; i < coun  nd        desc  for (let i = 0; i < count;?  ndfile_path = "src/hote
file_paStawith open(file_path, 'r', encodingconfile_paStawith open( M
new_func = """function generi
new_func = """funt n  profile: Player   new_func = """funt n desc = `${baseDesc} file_paStawith open(amnew_func = """function generi
new_func = """funt n  profile: Player xtnew_func = """funt n  profil}? eI  ??  eI  templeId: number,
t   templeIt  t   (!newTempleItemIds.i  startLogId: number M): {
  entr  )??   templeIt  t   (!newTempleI c  entr  ): _GRAD  eRO  entries: 
   ne??  newSGradeItems: st??c;   ne??  newSGradeItems: st?? ,  } {
  const wms } {
  const weights = TRAINI&   th  c
   c
   const weightie  // 动态生成br  // 动态生成未来时间（以当前时间为基准，每?; co  const times: string[] = [];
  fora  for (let i = 0; i < coun      icon = "📖";
        desc  fo);  for (let i = 0; i < coun  nd        desc  for (le r        desc  fo);  forn.sub(new_func, text)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(text)
print("replaced!")
