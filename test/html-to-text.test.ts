import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { htmlToText } from 'html-to-text';

test('HTML Tag Removal - Simple HTML', () => {
    expect(htmlToText('<div>hello</div>')).toBe('hello');
});

test('HTML Tag Removal - Ignore style content', () => {
    expect(htmlToText('<style>body { color: red; }</style><div>hello</div>')).toBe('hello');
});

test('HTML Tag Removal - Ignore script content', () => {
    expect(htmlToText('<script>alert("hello")</script><div>hello</div>')).toBe('hello');
});

test('HTML Tag Removal - Complex HTML file', async () => {
    const complexHtmlContent = await readFile('test/fixture-hello-world.html', 'utf-8');
    expect(htmlToText(complexHtmlContent)).toBe('Hello, World');
});

test('HTML Tag Removal - Nested tags', () => {
    expect(htmlToText('<div><span>Nested</span> tags</div>')).toBe('Nested tags');
});

test('HTML Tag Removal - Self-closing tags', () => {
    expect(htmlToText('Line break<br/>New line')).toBe('Line break\nNew line');
});

test('HTML Tag Removal - Tags with attributes', () => {
    expect(htmlToText('<p class="text">Paragraph with attributes</p>')).toBe('Paragraph with attributes');
});
