<?php

declare(strict_types=1);

final class StaticSitemapPublisher
{
    public function __construct(private readonly string $outputDirectory)
    {
        if (trim($this->outputDirectory) === '' || basename($this->outputDirectory) === '') {
            throw new InvalidArgumentException('Diretorio final de sitemap invalido.');
        }
    }

    public function createStagingDirectory(): string
    {
        $parent = dirname($this->outputDirectory);
        if (!is_dir($parent) && !mkdir($parent, 0775, true) && !is_dir($parent)) {
            throw new RuntimeException('Nao foi possivel criar o diretorio pai dos sitemaps.');
        }

        $stage = $this->outputDirectory . '.stage-' . getmypid() . '-' . bin2hex(random_bytes(4));
        if (!mkdir($stage, 0775, true) && !is_dir($stage)) {
            throw new RuntimeException('Nao foi possivel criar o staging dos sitemaps.');
        }
        return $stage;
    }

    public function promote(string $stagingDirectory): void
    {
        $this->assertManagedDirectory($stagingDirectory, '.stage-');
        if (!is_dir($stagingDirectory)) {
            throw new RuntimeException('Staging de sitemap inexistente.');
        }

        if (DIRECTORY_SEPARATOR !== '\\' && function_exists('symlink')) {
            $this->promoteWithAtomicSymlink($stagingDirectory);
            return;
        }

        $this->promoteWithDirectorySwap($stagingDirectory);
    }

    public function withdraw(): bool
    {
        if (!is_link($this->outputDirectory) && !file_exists($this->outputDirectory)) {
            return false;
        }

        $withdrawn = $this->outputDirectory . '.withdrawn-' . getmypid() . '-' . bin2hex(random_bytes(4));
        $previousTarget = is_link($this->outputDirectory) ? readlink($this->outputDirectory) : false;
        if (!rename($this->outputDirectory, $withdrawn)) {
            throw new RuntimeException('Nao foi possivel retirar atomicamente o sitemap publicado.');
        }

        if (is_link($withdrawn)) {
            if (!unlink($withdrawn)) {
                throw new RuntimeException('Nao foi possivel remover o ponteiro retirado do sitemap.');
            }
            $this->removePreviousRelease($previousTarget);
            return true;
        }

        if (!is_dir($withdrawn)) {
            throw new RuntimeException('Artefato publicado de sitemap possui tipo inesperado.');
        }
        self::removeDirectory($withdrawn);
        return true;
    }

    private function promoteWithAtomicSymlink(string $stagingDirectory): void
    {
        $release = $this->outputDirectory . '.release-' . getmypid() . '-' . bin2hex(random_bytes(4));
        if (!rename($stagingDirectory, $release)) {
            throw new RuntimeException('Nao foi possivel preparar o release imutavel do sitemap.');
        }

        try {
            self::sealDirectory($release);
        } catch (Throwable $error) {
            if (is_dir($release)) self::removeDirectory($release);
            throw $error;
        }

        $temporaryLink = $this->outputDirectory . '.link-' . getmypid() . '-' . bin2hex(random_bytes(4));
        $previousTarget = is_link($this->outputDirectory) ? readlink($this->outputDirectory) : false;
        $legacyDirectory = null;

        try {
            if (!symlink(basename($release), $temporaryLink)) {
                throw new RuntimeException('Nao foi possivel criar o ponteiro atomico do sitemap.');
            }

            if (!is_link($this->outputDirectory) && file_exists($this->outputDirectory)) {
                $legacyDirectory = $this->outputDirectory . '.legacy-' . getmypid() . '-' . bin2hex(random_bytes(4));
                if (!rename($this->outputDirectory, $legacyDirectory)) {
                    throw new RuntimeException('Nao foi possivel preservar o diretorio legado de sitemap.');
                }
            }

            if (!rename($temporaryLink, $this->outputDirectory)) {
                throw new RuntimeException('Nao foi possivel trocar o ponteiro atomico do sitemap.');
            }
        } catch (Throwable $error) {
            if (is_link($temporaryLink)) {
                @unlink($temporaryLink);
            }
            if ($legacyDirectory !== null && is_dir($legacyDirectory) && !file_exists($this->outputDirectory)) {
                @rename($legacyDirectory, $this->outputDirectory);
            }
            if (is_dir($release)) {
                self::removeDirectory($release);
            }
            throw $error;
        }

        if ($legacyDirectory !== null && is_dir($legacyDirectory)) {
            self::removeDirectory($legacyDirectory);
        }
        $this->removePreviousRelease($previousTarget);
    }

    private function promoteWithDirectorySwap(string $stagingDirectory): void
    {

        $backup = $this->outputDirectory . '.backup-' . getmypid() . '-' . bin2hex(random_bytes(4));
        $hadCurrent = is_dir($this->outputDirectory);
        if ($hadCurrent && !rename($this->outputDirectory, $backup)) {
            throw new RuntimeException('Nao foi possivel preservar o sitemap atualmente servido.');
        }

        try {
            if (!rename($stagingDirectory, $this->outputDirectory)) {
                throw new RuntimeException('Nao foi possivel promover o novo sitemap.');
            }
        } catch (Throwable $error) {
            if ($hadCurrent && is_dir($backup) && !is_dir($this->outputDirectory)) {
                @rename($backup, $this->outputDirectory);
            }
            throw $error;
        }

        if ($hadCurrent && is_dir($backup)) {
            self::removeDirectory($backup);
        }
    }

    private function removePreviousRelease(string|false $target): void
    {
        if (!is_string($target) || $target === '') {
            return;
        }

        $path = dirname($this->outputDirectory) . DIRECTORY_SEPARATOR . $target;
        if (dirname($path) !== dirname($this->outputDirectory)
            || !str_starts_with(basename($path), basename($this->outputDirectory) . '.release-')) {
            return;
        }
        if (is_dir($path)) {
            self::removeDirectory($path);
        }
    }

    public function discard(string $stagingDirectory): void
    {
        $this->assertManagedDirectory($stagingDirectory, '.stage-');
        if (is_dir($stagingDirectory)) {
            self::removeDirectory($stagingDirectory);
        }
    }

    private function assertManagedDirectory(string $directory, string $marker): void
    {
        if (dirname($directory) !== dirname($this->outputDirectory)
            || !str_starts_with(basename($directory), basename($this->outputDirectory) . $marker)) {
            throw new InvalidArgumentException('Diretorio fora da area gerenciada de sitemap.');
        }
    }

    private static function removeDirectory(string $directory): void
    {
        @chmod($directory, 0775);
        $items = scandir($directory);
        if ($items === false) {
            throw new RuntimeException('Nao foi possivel ler diretorio temporario de sitemap.');
        }
        foreach ($items as $item) {
            if ($item === '.' || $item === '..') {
                continue;
            }
            $path = $directory . DIRECTORY_SEPARATOR . $item;
            if (is_dir($path)) {
                self::removeDirectory($path);
            } else {
                @chmod($path, 0664);
                if (!unlink($path)) {
                throw new RuntimeException('Nao foi possivel remover artefato temporario de sitemap.');
                }
            }
        }
        if (!rmdir($directory)) {
            throw new RuntimeException('Nao foi possivel remover diretorio temporario de sitemap.');
        }
    }

    private static function sealDirectory(string $directory): void
    {
        foreach (scandir($directory) ?: [] as $item) {
            if ($item === '.' || $item === '..') continue;
            $path = $directory . DIRECTORY_SEPARATOR . $item;
            if (is_dir($path)) {
                self::sealDirectory($path);
            } elseif (!chmod($path, 0444)) {
                throw new RuntimeException('Nao foi possivel selar arquivo do release de sitemap.');
            }
        }
        if (!chmod($directory, 0555)) {
            throw new RuntimeException('Nao foi possivel selar diretorio do release de sitemap.');
        }
    }
}
