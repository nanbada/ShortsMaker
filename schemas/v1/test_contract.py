import copy,json,pathlib,unittest
from validate_spec import validate
base=json.loads((pathlib.Path(__file__).parent/'video-spec.example.json').read_text())
class ContractTests(unittest.TestCase):
 def test_valid(self):self.assertTrue(validate(base))
 def test_invalid(self):
  mutations=[lambda v:v.update(extra=True),lambda v:v['format'].update(fps=60),lambda v:v['assets'].append(v['assets'][0]),lambda v:v['scenes'][1].update(startFrame=226),lambda v:v['narration'].update(durationMs=29900),lambda v:v['captions'][0].update(endMs=0),lambda v:v['scenes'][1].update(assetId='missing'),lambda v:v['safeArea'].update(right=2000),lambda v:v['assets'][0].update(path='../secret'),lambda v:v['scenes'][-1]['transitionOut'].update(type='crossfade',durationFrames=10)]
  for i,mutate in enumerate(mutations):
   with self.subTest(i=i):
    v=copy.deepcopy(base);mutate(v)
    with self.assertRaises(ValueError):validate(v)
 def test_crossfade(self):
  v=copy.deepcopy(base)
  v['scenes'][0]['transitionOut']={'type':'crossfade','durationFrames':15}
  for s in v['scenes'][1:]:s['startFrame']-=15
  v['format']['durationFrames']=885;v['narration']['durationMs']=29500
  self.assertTrue(validate(v))
if __name__=='__main__':unittest.main()
