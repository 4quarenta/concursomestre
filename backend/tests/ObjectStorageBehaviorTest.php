<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/shared/storage/ObjectStorage.php';

function objectStorageAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$root = sys_get_temp_dir() . '/cm-object-storage-' . bin2hex(random_bytes(6));
$source = tempnam(sys_get_temp_dir(), 'cm-upload-');
file_put_contents($source, 'object-storage-test', LOCK_EX);

try {
    $storage = new ObjectStorage([
        'driver' => 'local',
        'localRoot' => $root,
        'publicBaseUrl' => 'https://cdn.example.test/assets',
    ]);
    $stored = $storage->storeUploadedFile($source, 'profiles/test-file.txt', 'text/plain');
    objectStorageAssert($stored['storageKey'] === 'profiles/test-file.txt', 'Storage key divergente.');
    objectStorageAssert(
        $stored['url'] === 'https://cdn.example.test/assets/profiles/test-file.txt',
        'URL publica divergente.'
    );
    objectStorageAssert(is_file($root . '/profiles/test-file.txt'), 'Objeto local nao foi materializado.');
    objectStorageAssert(
        file_get_contents($root . '/profiles/test-file.txt') === 'object-storage-test',
        'Conteudo armazenado diverge da origem.'
    );

    $bytes = $storage->storeBytes('second-object', 'question-assets/second.txt', 'text/plain');
    objectStorageAssert(is_file($root . '/question-assets/second.txt'), 'storeBytes nao materializou o objeto.');
    objectStorageAssert($bytes['size'] === 13, 'Tamanho do objeto salvo incorreto.');
    objectStorageAssert(
        $storage->storageKeyFromPublicUrl('https://cdn.example.test/assets/profiles/avatar%2Epng') === 'profiles/avatar.png',
        'URL publica nao foi convertida de volta para chave.'
    );
    objectStorageAssert(
        $storage->storageKeyFromPublicUrl('https://other.example.test/assets/profiles/avatar.png') === null,
        'URL externa ao storage foi aceita.'
    );

    $storage->delete('profiles/test-file.txt');
    objectStorageAssert(!is_file($root . '/profiles/test-file.txt'), 'Exclusao do objeto local falhou.');

    try {
        $storage->storeBytes('unsafe', '../escape.txt', 'text/plain');
        throw new RuntimeException('Traversal deveria ter sido rejeitado.');
    } catch (InvalidArgumentException) {
        // expected
    }
} finally {
    @unlink($source);
    if (is_dir($root . '/question-assets')) {
        @unlink($root . '/question-assets/second.txt');
        @rmdir($root . '/question-assets');
    }
    if (is_dir($root . '/profiles')) {
        @rmdir($root . '/profiles');
    }
    @rmdir($root);
}

fwrite(STDOUT, "Object storage behavior assertions passed.\n");
