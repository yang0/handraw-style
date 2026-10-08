"""Validate the package, record current adaptations and synchronize project-installed files."""
from pathlib import Path
import argparse,hashlib,json,re,shutil
from urllib.parse import unquote,urlparse
ROOT=Path(__file__).resolve().parents[1]
PROJECT=next(p for p in ROOT.parents if (p/'styles_200_reorganized.md').exists())
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--sync',action='store_true');a=ap.parse_args()
 for name in ['SKILL.md','references/art_motion_integration_guide.md']:
  p=ROOT/name;s=p.read_text(encoding='utf-8')
  if name=='SKILL.md':assert s.startswith('---\nname: handraw-video-producer\n') and 'description:' in s
  for v in re.findall(r'\]\(([^)]+)\)',s):
   if v.startswith('file:'):assert Path(unquote(urlparse(v).path).lstrip('/')).exists(),(p,v)
   elif not v.startswith(('http:','https:','#')):assert (p.parent/v.split('#')[0]).exists(),(p,v)
 manifest_path=ROOT/'lib/art_motion/import_manifest.json'
 manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
 for record in manifest['files']:
  p=ROOT/record['destination'];assert p.exists(),p
  record['adapted_sha256']=digest(p)
 manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
 files=[p for p in ROOT.rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.suffix not in ['.pyc','.pyo']]
 target=PROJECT/'.agents/skills/handraw-video-producer'
 if a.sync:
  for p in files:
   q=target/p.relative_to(ROOT);q.parent.mkdir(parents=True,exist_ok=True)
   if not q.exists() or digest(p)!=digest(q):shutil.copy2(p,q)
  for p in files:assert digest(p)==digest(target/p.relative_to(ROOT)),p
  # Sync the explicit art/scroll route without touching unrelated installed edits.
  p=PROJECT/'skills/knowledge-video-director/SKILL.md';q=PROJECT/'.agents/skills/knowledge-video-director/SKILL.md'
  paragraph=next(x.strip() for x in p.read_text(encoding='utf-8').split('\n\n') if x.strip().startswith('用户明确选择艺术动画'))
  text=q.read_text(encoding='utf-8')
  if paragraph not in text:text=text.replace('## 一、 核心叙事架构',paragraph+'\n\n## 一、 核心叙事架构',1);q.write_text(text,encoding='utf-8')
  print('SYNC PASS:',len(files),'package files; installed art/scroll routing updated')
 else:print('PACKAGE PASS:',len(files),'files; all entrypoint links resolve')
if __name__=='__main__':main()
