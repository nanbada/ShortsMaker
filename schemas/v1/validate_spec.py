#!/usr/bin/env python3
"""Dependency-free checker for the keywords used by the bundled schema only."""
import json, math, pathlib, re, sys
ROOT=pathlib.Path(__file__).parent
SCHEMA=json.loads((ROOT/'video-spec.schema.json').read_text())
def structure(value,s,path='$'):
 if '$ref' in s: return structure(value,SCHEMA['$defs'][s['$ref'].split('/')[-1]],path)
 if 'oneOf' in s:
  matches=0
  for candidate in s['oneOf']:
   try: structure(value,candidate,path); matches+=1
   except ValueError: pass
  if matches!=1: raise ValueError(f'{path}: oneOf matches={matches}')
  return
 def fail(msg): raise ValueError(f'{path}: {msg}')
 if 'const' in s and value!=s['const']: fail('const')
 if 'enum' in s and value not in s['enum']: fail('enum')
 typ=s.get('type')
 if typ=='object':
  if not isinstance(value,dict): fail('object expected')
  for k in s.get('required',[]):
   if k not in value: fail('missing '+k)
  for k,v in value.items():
   if k not in s['properties']: fail('unknown '+k)
   structure(v,s['properties'][k],path+'.'+k)
 elif typ=='array':
  if not isinstance(value,list): fail('array expected')
  if len(value)<s.get('minItems',0): fail('minItems')
  for i,v in enumerate(value):structure(v,s['items'],f'{path}[{i}]')
 elif typ=='string':
  if not isinstance(value,str):fail('string expected')
  if len(value)<s.get('minLength',0):fail('minLength')
  if 'pattern' in s and not re.search(s['pattern'],value):fail('pattern')
 elif typ in ('integer','number'):
  if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value):fail('number expected')
  if typ=='integer' and value!=int(value):fail('integer expected')
  if value<s.get('minimum',-math.inf) or value>s.get('maximum',math.inf):fail('range')
def validate(v):
 structure(v,SCHEMA)
 def need(cond,msg):
  if not cond: raise ValueError(msg)
 assets={a['id']:a for a in v['assets']}
 need(len(assets)==len(v['assets']),'duplicate asset id')
 def asset(a,k):need(a in assets and assets[a]['kind']==k,'asset reference/type: '+a)
 asset(v['brand']['fontAssetId'],'font'); asset(v['narration']['assetId'],'audio')
 f=v['format']; n=v['narration']; total=f['durationFrames']
 need(total==math.ceil(n['durationMs']*f['fps']/1000+n['offsetFrame']),'narration duration mismatch')
 a=v['safeArea'];need(a['left']+a['right']<f['width'] and a['top']+a['bottom']<f['height'],'invalid safe area')
 scenes=v['scenes'];need(len({s['id'] for s in scenes})==len(scenes),'duplicate scene id')
 need(scenes[0]['startFrame']==0,'first scene start')
 for i,s in enumerate(scenes):
  end=s['startFrame']+s['durationFrames'];t=s['transitionOut'];d=t['durationFrames']
  need(end<=total,'scene exceeds duration')
  need((t['type']=='cut' and d==0) or (t['type']=='crossfade' and d>0),'transition type/duration')
  if 'assetId' in s: asset(s['assetId'],'image')
  if i+1<len(scenes):
   nxt=scenes[i+1];need(nxt['startFrame']==end-d,'timeline gap/overlap')
   need(d<min(s['durationFrames'],nxt['durationFrames']),'transition too long')
   if i>0:need(nxt['startFrame']>=scenes[i-1]['startFrame']+scenes[i-1]['durationFrames'],'triple overlap')
  else:need(end==total and t['type']=='cut' and d==0,'last scene end/transition')
 previous=0
 for c in v['captions']:
  need(previous<=c['startMs']<c['endMs']<=total*1000/f['fps'],'caption interval')
  need(c['startMs']>=n['offsetFrame']*1000/f['fps'],'caption before narration')
  previous=c['endMs']
 return True
if __name__=='__main__':
 try:validate(json.loads(pathlib.Path(sys.argv[1]).read_text()));print('PASS: structure and semantic contract (not asset/render QA)')
 except (ValueError,KeyError,IndexError) as e:print('FAIL:',e);sys.exit(1)
