<#
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
#>

param(
    [string]$FrontendRoot = 'C:\dev\concursomestre',
    [string]$BackendRoot = 'C:\xampp\htdocs\questao-pro-backend',
    [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'

function Remove-Diacritics {
    param(
        [string]$Value
    )

    $normalized = $Value.Normalize([Text.NormalizationForm]::FormD)
    $builder = New-Object System.Text.StringBuilder

    foreach ($char in $normalized.ToCharArray()) {
        if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($char) -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
            [void]$builder.Append($char)
        }
    }

    return $builder.ToString().Normalize([Text.NormalizationForm]::FormC)
}

function Get-PlaceholderVariant {
    param(
        [string]$Value
    )

    $builder = New-Object System.Text.StringBuilder

    foreach ($char in $Value.ToCharArray()) {
        if ([int][char]$char -gt 127) {
            [void]$builder.Append('?')
        } else {
            [void]$builder.Append($char)
        }
    }

    return $builder.ToString()
}

function New-AccentReplacementMap {
    $glossary = @(
        'ação', 'ações', 'aplicação', 'aplicações', 'aprovação', 'autenticação', 'autenticações',
        'automática', 'automático', 'avaliação', 'benefício', 'benefícios', 'básico',
        'cabeçalho', 'cartão', 'cobrança', 'comentário', 'comentários', 'configuração', 'configurações',
        'conexão', 'conteúdo', 'conteúdos', 'código', 'crítico', 'denúncia', 'denúncias',
        'descrição', 'disponível', 'dúvida', 'dúvidas', 'e-mail', 'evidência', 'evolução',
        'formulário', 'gestão', 'grátis', 'histórico', 'homologação', 'ícone', 'integração',
        'integrações', 'já', 'máximo', 'mês', 'meses', 'mínimo', 'moderação', 'mutação',
        'não', 'notificação', 'notificações', 'operação', 'operações', 'período', 'períodos',
        'possível', 'produção', 'pública', 'públicas', 'público', 'pontuação', 'questão',
        'questões', 'redirecionamento', 'redefinição', 'relação', 'relatório', 'relatórios',
        'renovação', 'reputação', 'segurança', 'serviço', 'serviços', 'sessão', 'solução',
        'também', 'técnico', 'técnicos', 'título', 'transação', 'transações', 'transformação',
        'último', 'últimos', 'usuário', 'usuários', 'validação', 'você', 'vocês', 'estão',
        'análise'
    )

    $map = @{}

    foreach ($word in $glossary) {
        $variants = @(
            $word,
            (Get-Culture).TextInfo.ToTitleCase($word),
            $word.ToUpper()
        ) | Select-Object -Unique

        foreach ($target in $variants) {
            $plain = Remove-Diacritics -Value $target
            $placeholder = Get-PlaceholderVariant -Value $target

            if ($plain -ne $target) {
                $map[$plain] = $target
            }

            if ($placeholder -ne $target) {
                $map[$placeholder] = $target
            }
        }
    }

    return $map
}

function New-RawReplacementMap {
    $bulletMojibake = ([char]0x00E2).ToString() + ([char]0x20AC) + ([char]0x00A2)
    $emdashMojibake = ([char]0x00E2).ToString() + ([char]0x20AC) + ([char]0x201D)

    return @{
        $bulletMojibake = ([char]0x2022).ToString()
        $emdashMojibake = ([char]0x2014).ToString()
    }
}

function Get-TargetFiles {
    param(
        [string]$FrontendRoot,
        [string]$BackendRoot
    )

    $roots = @(
        (Join-Path $FrontendRoot 'src'),
        (Join-Path $FrontendRoot 'docs'),
        (Join-Path $BackendRoot 'modules'),
        (Join-Path $BackendRoot 'shared'),
        (Join-Path $BackendRoot 'scripts'),
        (Join-Path $BackendRoot 'tests')
    ) | Where-Object { Test-Path $_ }

    $extensions = @('*.ts', '*.tsx', '*.js', '*.jsx', '*.json', '*.md', '*.php', '*.ps1', '*.sql')

    $files = foreach ($root in $roots) {
        Get-ChildItem -Path $root -Recurse -File -Include $extensions | Select-Object -ExpandProperty FullName
    }

    return $files | Sort-Object -Unique
}

function Repair-Line {
    param(
        [string]$Line,
        [hashtable]$RawMap,
        [System.Collections.Generic.List[object]]$WordPatterns
    )

    $updated = $Line

    foreach ($entry in $RawMap.GetEnumerator()) {
        $updated = $updated.Replace($entry.Key, $entry.Value)
    }

    foreach ($entry in $WordPatterns) {
        $updated = $entry.Pattern.Replace($updated, $entry.Target)
    }

    return $updated
}

$utf8 = New-Object System.Text.UTF8Encoding($false)
$accentMap = New-AccentReplacementMap
$rawMap = New-RawReplacementMap
$wordPatterns = New-Object 'System.Collections.Generic.List[object]'

foreach ($source in ($accentMap.Keys | Sort-Object @{ Expression = { $_.Length }; Descending = $true }, @{ Expression = { $_ } })) {
    $pattern = '(?<![\p{L}\p{Nd}_])' + [regex]::Escape($source) + '(?![\p{L}\p{Nd}_])'
    $wordPatterns.Add([pscustomobject]@{
        Pattern = [regex]::new($pattern)
        Target  = $accentMap[$source]
    })
}

$files = Get-TargetFiles -FrontendRoot $FrontendRoot -BackendRoot $BackendRoot
$changedFiles = 0
$changedLines = 0
$pending = @()

foreach ($file in $files) {
    $original = [System.IO.File]::ReadAllText($file, $utf8)
    $normalizedOriginal = $original.Replace("`r`n", "`n").Replace("`r", "`n")
    $hasTrailingNewline = $normalizedOriginal.EndsWith("`n")
    $lines = $normalizedOriginal -split "`n"
    while ($hasTrailingNewline -and $lines.Count -gt 0 -and $lines[-1] -eq '') {
        if ($lines.Count -eq 1) {
            $lines = @()
            break
        }

        $lines = $lines[0..($lines.Count - 2)]
    }
    $updatedLines = New-Object System.Collections.Generic.List[string]
    $localChanges = 0

    foreach ($line in $lines) {
        $updatedLine = Repair-Line -Line $line -RawMap $rawMap -WordPatterns $wordPatterns
        if ($updatedLine -ne $line) {
            $localChanges++
        }
        $updatedLines.Add($updatedLine)
    }

    $updated = [string]::Join("`n", $updatedLines)
    if ($hasTrailingNewline) {
        $updated += "`n"
    }

    if ($updated -ne $original) {
        if ($CheckOnly) {
            $pending += $file
        } else {
            [System.IO.File]::WriteAllText($file, $updated, $utf8)
            $changedFiles++
            $changedLines += $localChanges
        }
    }
}

if ($CheckOnly) {
    if ($pending.Count -gt 0) {
        $pending | ForEach-Object { Write-Output ("PORTUGUESE_ACCENT_PENDING|{0}" -f $_) }
        exit 1
    }

    Write-Output 'PORTUGUESE_ACCENT_CHECK|OK'
    exit 0
}

Write-Output ("PORTUGUESE_ACCENT_FIX|FILES|{0}|LINES|{1}" -f $changedFiles, $changedLines)
