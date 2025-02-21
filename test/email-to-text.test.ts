import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { emailToText } from '../src/utils/emailCleaner.ts';
import assert from 'assert';

test('HTML Tag Removal - Simple HTML', () => {
    assert.strictEqual(emailToText('<div>hello</div>'), 'hello');
});

test('HTML Tag Removal - Ignore style content', () => {
    assert.strictEqual(emailToText('<style>body { color: red; }</style><div>hello</div>'), 'hello');
});

test('HTML Tag Removal - Ignore script content', () => {
    assert.strictEqual(emailToText('<script>alert("hello")</script><div>hello</div>'), 'hello');
});

test('HTML Tag Removal - Complex HTML file', async () => {
    const complexHtmlContent = await readFile('test/fixture-hello-world.html', 'utf-8');
    assert.strictEqual(emailToText(complexHtmlContent), 'Hello, World');
});

test('HTML Tag Removal - Nested tags', () => {
    assert.strictEqual(emailToText('<div><span>Nested</span> tags</div>'), 'Nested tags');
});

test('HTML Tag Removal - Self-closing tags', () => {
    assert.strictEqual(emailToText('Line break<br/>New line'), 'Line break\nNew line');
});

test('HTML Tag Removal - Tags with attributes', () => {
    assert.strictEqual(emailToText('<p class="text">Paragraph with attributes</p>'), 'Paragraph with attributes');
});
