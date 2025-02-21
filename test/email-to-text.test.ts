import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { emailToText } from '../src/utils/emailCleaner';
import quotedPrintable from 'quoted-printable';

test('HTML Tag Removal - Simple HTML', () => {
    expect(emailToText('<div>hello</div>')).toBe('hello');
});

test('HTML Tag Removal - Ignore style content', () => {
    expect(emailToText('<style>body { color: red; }</style><div>hello</div>')).toBe('hello');
});

test('HTML Tag Removal - Ignore script content', () => {
    expect(emailToText('<script>alert("hello")</script><div>hello</div>')).toBe('hello');
});

test('HTML Tag Removal - Complex HTML file', async () => {
    const complexHtmlContent = await readFile('test/fixture-hello-world.html', 'utf-8');
    expect(emailToText(complexHtmlContent)).toBe('Hello, World');
});

test('HTML Tag Removal - Nested tags', () => {
    expect(emailToText('<div><span>Nested</span> tags</div>')).toBe('Nested tags');
});

test('HTML Tag Removal - Self-closing tags', () => {
    expect(emailToText('Line break<br/>New line')).toBe('Line break\nNew line');
});

test('HTML Tag Removal - Tags with attributes', () => {
    expect(emailToText('<p class="text">Paragraph with attributes</p>')).toBe('Paragraph with attributes');
});
