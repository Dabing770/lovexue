import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../.private/projects/love.html', import.meta.url), 'utf8');
for (const [, script] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(script);
const extract = name => {
  const match = html.match(new RegExp(`    function ${name}\\([^]*?\\n    }`));
  assert.ok(match, `Missing ${name}`);
  return match[0];
};
const rect = (left, top, width, height) => ({left, top, width, height, right:left+width, bottom:top+height});
const cases = [
  [rect(12,60,296,227), rect(12,295,296,261)],
  [rect(12,60,351,330), rect(12,398,351,257)],
  [rect(12,60,512,318), rect(532,60,300,318)],
  [rect(0,0,1440,900), rect(440,620,560,260)],
  [rect(12,60,296,480), null]
];
for (const [stage, panel] of cases) {
  for (const [frameWidth, frameHeight] of [[3,3],[8,2],[2,8]]) {
    const context = vm.createContext({
      camera: {position:{z:50,y:2}, aspect:stage.width/stage.height},
      renderer:{domElement:{getBoundingClientRect:()=>stage}},
      document:{getElementById:()=>({hidden:!panel,getBoundingClientRect:()=>panel || rect(0,0,0,0)}), querySelector:()=>({getBoundingClientRect:()=>rect(12,12,170,36)})},
      focusWorldPos:{}, focusScale:4.5,
      STATE:{focusTarget:{userData:{frameWidth,frameHeight},scale:{x:4.5,setScalar(){}}}}
    });
    vm.runInContext([extract('fitCameraFov'), extract('fitPhotoScale'), extract('updateFocusLayout'), 'camera.fov=fitCameraFov(camera.aspect); updateFocusLayout();'].join('\n'), context);
    const visibleHeight = 2 * (50-35-0.15) * Math.tan(context.camera.fov*Math.PI/360);
    const scale = context.focusScale;
    const centerY = stage.top + stage.height/2 - (context.focusWorldPos.y-2)/visibleHeight*stage.height;
    const photoHeight = frameHeight*scale/visibleHeight*stage.height;
    const photoWidth = frameWidth*scale/visibleHeight*stage.height;
    assert.ok(photoWidth <= stage.width, 'Photo exceeds stage width');
    assert.ok(centerY-photoHeight/2 >= Math.max(stage.top,48), 'Photo exceeds header');
    const bottom = panel && panel.left < stage.right && panel.right > stage.left ? panel.top : stage.bottom;
    assert.ok(centerY+photoHeight/2 <= bottom, 'Photo overlaps controls or stage edge');
    assert.ok(Number.isFinite(scale) && scale > 0);
  }
}
console.log('Love layout: script syntax and 15 portrait/landscape/desktop photo-fit cases passed.');
