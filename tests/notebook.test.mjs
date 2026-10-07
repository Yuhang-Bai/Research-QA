import test from 'node:test';
import assert from 'node:assert/strict';
import {contentTags,contentReferences,matchesLibraryFilter} from '../src/lib/notebook.js';

test('notebook tags are derived from prose and notes without changing stored records',()=>{
    const item={desc:'# Title\n#图论 #matroid #图论\n`#code`\n```md\n#fenced\n```',answers:[{text:'A note #组合数学'}]};
    const original=structuredClone(item);
    assert.deepEqual(contentTags(item),['图论','matroid','组合数学']);assert.deepEqual(item,original);
});
test('tag extraction ignores headings, fragments and images and bounds large lists',()=>{
    assert.deepEqual(contentTags({desc:'## Heading\n[URL](https://example.com/#fragment)\nno#tag\n#valid_tag #tag-2'}),['valid_tag','tag-2']);
    assert.equal(contentTags({desc:Array.from({length:100},(_,i)=>'#t'+i).join(' ')}).length,40);
});
test('references use actual HTTP links and reject scripts, credentials and image embeds',()=>{
    const item={desc:'[Paper](https://example.com/paper)\n[Again](https://example.com/paper)\n[unsafe](javascript:alert(1))\n![image](https://example.com/image.png)\n[secret](https://user:pass@example.com/private)',answers:[{text:'[Second](http://example.org "Title")'}]};
    assert.deepEqual(contentReferences(item),[{title:'Paper',url:'https://example.com/paper'},{title:'Second',url:'http://example.org/'}]);
});
test('library filters describe existing pin, note and share data only',()=>{
    const item={isPinned:true,answers:[{text:'n'}],shareId:''};
    assert.equal(matchesLibraryFilter(item,'all'),true);assert.equal(matchesLibraryFilter(item,'pinned'),true);assert.equal(matchesLibraryFilter(item,'notes'),true);assert.equal(matchesLibraryFilter(item,'shared'),false);
});

test('reference parsing preserves balanced URLs and excludes code samples',()=>{
    const item={desc:'[Real](https://example.com/Math_(topic))\n\n`[Inline](https://example.com/inline)`\n\n```md\n[Sample](https://example.com/sample)\n```'};
    assert.deepEqual(contentReferences(item),[{title:'Real',url:'https://example.com/Math_(topic)'}]);
});
