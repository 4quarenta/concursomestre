<?php
declare(strict_types=1);
require_once __DIR__.'/../modules/ingestion/services/CmBatchMediaStore.php';
$root=sys_get_temp_dir().DIRECTORY_SEPARATOR.'cm-batch-media-'.bin2hex(random_bytes(6));
mkdir($root,0700);
$archive=$root.DIRECTORY_SEPARATOR.'fixture.zip';
$zip=new ZipArchive();
$zip->open($archive,ZipArchive::CREATE);
$image=base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf9sAAAAASUVORK5CYII=');
$zip->addFromString('assets/one.png',$image);
$zip->addFromString('assets/two.png',$image);
$zip->addFromString('assets/active.svg','<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>');
$zip->close();
$zip->open($archive,ZipArchive::RDONLY);
try {
    $store=new CmBatchMediaStore($root);
    $file=['path'=>'assets/one.png','sha256'=>hash('sha256',$image),'bytes'=>strlen($image)];
    $first=$store->stage($zip,$file);
    $second=$store->stage($zip,array_merge($file,['path'=>'assets/two.png']));
    if($first['storageKey']!==$second['storageKey'] || count(glob($root.DIRECTORY_SEPARATOR.'*.png'))!==1) throw new RuntimeException('Media deduplication failed');
    foreach ([array_merge($file,['sha256'=>str_repeat('a',64)]),array_merge($file,['path'=>'../escape.png'])] as $invalid) {
        try { $store->stage($zip,$invalid); throw new RuntimeException('Invalid media accepted'); } catch(InvalidArgumentException) {}
    }
    $svg=$zip->getFromName('assets/active.svg');
    try { $store->stage($zip,['path'=>'assets/active.svg','sha256'=>hash('sha256',$svg),'bytes'=>strlen($svg)]); throw new RuntimeException('Active SVG accepted'); } catch(InvalidArgumentException) {}
    echo "CmBatchMediaStoreTest: PASS (binary deduplication, hash mismatch, traversal, SVG rejection)\n";
} finally {
    $zip->close();
    foreach(scandir($root) as $file) if($file!=='.' && $file!=='..') unlink($root.DIRECTORY_SEPARATOR.$file);
    rmdir($root);
}
