<?php
declare(strict_types=1);

/** Private, content-addressed binary staging. No URL fetching or executable formats. */
final class CmBatchMediaStore
{
    private const MIME_EXTENSIONS = [
        'image/png'=>'png','image/jpeg'=>'jpg','image/gif'=>'gif','image/webp'=>'webp',
        'application/pdf'=>'pdf',
    ];

    public function __construct(private readonly string $root)
    {
        if (!is_dir($root) || is_link($root) || !is_writable($root)) {
            throw new InvalidArgumentException('Storage privado de midia inexistente ou inseguro.');
        }
    }

    public function stage(ZipArchive $zip, array $verifiedFile): array
    {
        $path=(string)($verifiedFile['path']??'');
        $hash=strtolower((string)($verifiedFile['sha256']??''));
        $expectedBytes=$verifiedFile['bytes']??null;
        if (!preg_match('/^[a-f0-9]{64}$/',$hash) || !is_int($expectedBytes) || $expectedBytes<1 || $expectedBytes>32*1024*1024) {
            throw new InvalidArgumentException('Identidade de midia invalida.');
        }
        if ($path==='' || str_contains($path,'\\') || str_starts_with($path,'/') || preg_match('~(^|/)\.\.?(/|$)|^[a-z]+:~i',$path)) {
            throw new InvalidArgumentException('Caminho de midia invalido.');
        }
        $source=$zip->getStream($path);
        if (!is_resource($source)) throw new InvalidArgumentException('Midia nao localizada no ZIP: '.$path);
        $temporary=tempnam($this->root,'cm-media-');
        if ($temporary===false) { fclose($source); throw new RuntimeException('Falha no staging de midia.'); }
        $destination=fopen($temporary,'wb');
        if (!is_resource($destination)) { fclose($source); unlink($temporary); throw new RuntimeException('Falha ao abrir staging.'); }
        $digest=hash_init('sha256');
        $bytes=0;
        try {
            while (!feof($source)) {
                $chunk=fread($source,65536);
                if ($chunk===false) throw new RuntimeException('Falha na leitura de midia.');
                $bytes+=strlen($chunk);
                if ($bytes>$expectedBytes) throw new InvalidArgumentException('Midia excede tamanho verificado.');
                hash_update($digest,$chunk);
                if (fwrite($destination,$chunk)!==strlen($chunk)) throw new RuntimeException('Falha na escrita de midia.');
            }
            fclose($source); $source=null;
            fclose($destination); $destination=null;
            if ($bytes!==$expectedBytes || !hash_equals($hash,hash_final($digest))) throw new InvalidArgumentException('Hash ou tamanho binario divergente.');
            $mime=(new finfo(FILEINFO_MIME_TYPE))->file($temporary);
            if (!isset(self::MIME_EXTENSIONS[$mime])) throw new InvalidArgumentException('Formato exige revisao e nao pode ser servido como midia: '.$mime);
            if (str_starts_with($mime,'image/')) {
                $dimensions=@getimagesize($temporary);
                if (!$dimensions || $dimensions[0]<1 || $dimensions[1]<1 || $dimensions[0]*$dimensions[1]>40000000) {
                    throw new InvalidArgumentException('Dimensoes de imagem invalidas ou excessivas.');
                }
            }
            $name=$hash.'.'.self::MIME_EXTENSIONS[$mime];
            $target=$this->root.DIRECTORY_SEPARATOR.$name;
            // Exclusive creation handles concurrent staging without replacing an existing asset.
            $lock=fopen($this->root.DIRECTORY_SEPARATOR.'.lock','c');
            if (!$lock || !flock($lock,LOCK_EX)) throw new RuntimeException('Falha ao bloquear storage de midia.');
            try {
                if (is_link($target)) throw new RuntimeException('Destino de midia inseguro.');
                if (is_file($target)) {
                    if (!hash_equals($hash,(string)hash_file('sha256',$target))) throw new RuntimeException('Midia armazenada corrompida.');
                } elseif (!rename($temporary,$target)) throw new RuntimeException('Falha ao concluir staging de midia.');
                chmod($target,0600);
            } finally { flock($lock,LOCK_UN); fclose($lock); }
            return ['sha256'=>$hash,'bytes'=>$bytes,'mimeType'=>$mime,'storageKey'=>$name];
        } finally {
            if (is_resource($source)) fclose($source);
            if (is_resource($destination)) fclose($destination);
            if (is_file($temporary)) unlink($temporary);
        }
    }
}
