<?php

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

/**
 * Worker operacional do importador de questões da Gran.
 * Esta ferramenta foi movida da raiz `scrapper/` para `scripts/importers/`
 * porque pertence ao fluxo interno de ingestao, não a um dominio HTTP público.
 */
ini_set('display_errors', 0);
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING & ~E_DEPRECATED);
header('Content-Type: application/json');

session_start();
set_time_limit(300); // 5 minutes per page

include_once '../../../../config/database.php';

define('GRAN_API_ENDPOINT', 'https://rota-api.grancursosonline.com.br/v1/elastic/questao');
define('GRAN_WEB_ORIGIN', 'https://questoes.grancursosonline.com.br');
define('GRAN_FILES_BASE_URL', 'https://arquivos.infra-questoes.grancursosonline.com.br');

/**
 * Decodifica o payload do JWT da Gran para validacao local do token.
 *
 * @since 1.0.0
 */
function decodeGranJwtPayload($token) {
    $segments = explode('.', (string) $token);
    if (count($segments) < 2) {
        return null;
    }

    $payload = strtr($segments[1], '-_', '+/');
    $padding = strlen($payload) % 4;
    if ($padding > 0) {
        $payload .= str_repeat('=', 4 - $padding);
    }

    $decoded = base64_decode($payload, true);
    if ($decoded === false) {
        return null;
    }

    $data = json_decode($decoded, true);
    return is_array($data) ? $data : null;
}

/**
 * Retorna o timestamp de expiracao do bearer, quando presente.
 *
 * @since 1.0.0
 */
function getGranTokenExpiration($token) {
    $payload = decodeGranJwtPayload($token);
    if (!is_array($payload) || empty($payload['exp'])) {
        return null;
    }

    return (int) $payload['exp'];
}

/**
 * Informa se o bearer ja expirou.
 *
 * @since 1.0.0
 */
function isGranTokenExpired($token) {
    $expiration = getGranTokenExpiration($token);
    if (!$expiration) {
        return false;
    }

    return $expiration <= time();
}

/**
 * Monta a URL oficial da busca de questoes da Gran em formato ASCII-safe.
 *
 * @since 1.0.0
 */
function buildGranQuestionsApiUrl($page, $perPage, $anoFilter = '') {
    $query = [
        'perPage' => max(1, (int) $perPage),
        'page' => max(1, (int) $page),
        'marcarResolvidas' => 1,
        'resolucao' => 'TODAS',
        'anulada' => 0,
        'desatualizada' => 0,
        'tiposProva' => 1,
        'sort' => '[{"anos":"desc"},{"_score":"desc"}]',
    ];

    if ($anoFilter !== '' && $anoFilter !== null) {
        $query['anos[]'] = trim((string) $anoFilter);
    }

    return GRAN_API_ENDPOINT . '?' . http_build_query($query);
}

/**
 * Gera a URL absoluta de assets da Gran de forma consistente.
 *
 * @since 1.0.0
 */
function buildGranAssetUrl($path) {
    $normalizedPath = trim((string) $path);
    if ($normalizedPath === '') {
        return null;
    }

    if (preg_match('/^https?:\/\//i', $normalizedPath)) {
        return $normalizedPath;
    }

    return GRAN_FILES_BASE_URL . (strpos($normalizedPath, '/') === 0 ? '' : '/') . $normalizedPath;
}

/**
 * Executa uma chamada HTTP oficial para a API da Gran com headers padronizados.
 *
 * @since 1.0.0
 */
function performGranApiRequest($url, $token) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_ENCODING, '');
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 15);
    curl_setopt($ch, CURLOPT_TIMEOUT, 60);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'accept: application/json, text/plain, */*',
        'accept-language: pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'authorization: Bearer ' . $token,
        'origin: ' . GRAN_WEB_ORIGIN,
        'referer: ' . GRAN_WEB_ORIGIN . '/',
        'priority: u=1, i',
        'user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
        'sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
        'sec-ch-ua-mobile: ?0',
        'sec-ch-ua-platform: "Windows"',
        'sec-fetch-dest: empty',
        'sec-fetch-mode: cors',
        'sec-fetch-site: same-site'
    ]);

    $response = curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    return [
        'response' => $response,
        'http_code' => $httpCode,
        'curl_error' => $curlError,
    ];
}

function slugify($text) {
    if (empty($text)) return 'n-a';
    $text = preg_replace('~[^\pL\d]+~u', '-', $text);
    $text = iconv('utf-8', 'us-ascii//TRANSLIT', $text);
    $text = preg_replace('~[^-\w]+~', '', $text);
    $text = trim($text, '-');
    $text = preg_replace('~-+~', '-', $text);
    $text = strtolower($text);
    return $text;
}

function getOrCreateFilter($db, $type, $name, $description = null) {
    if (empty($name)) return null;
    
    // Clean up hyphens if it's not a slug (Gran API sometimes sends names with hyphens)
    $name = str_replace('-', ' ', $name);
    
    $slug = slugify($name);
    
    $stmt = $db->prepare("SELECT id FROM filters WHERE type = :type AND slug = :slug LIMIT 1");
    $stmt->execute([':type' => $type, ':slug' => $slug]);
    $filter = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($filter) {
        // Update description if it was null and we have one now
        if ($description && empty($filter['description'])) {
            $upd = $db->prepare("UPDATE filters SET description = :desc WHERE id = :id");
            $upd->execute([':desc' => $description, ':id' => $filter['id']]);
        }
        return $filter['id'];
    }
    
    $stmt = $db->prepare("INSERT INTO filters (type, name, slug, description) VALUES (:type, :name, :slug, :description)");
    $stmt->execute([':type' => $type, ':name' => $name, ':slug' => $slug, ':description' => $description]);
    return $db->lastInsertId();
}

function getOrCreateProva($db, $nome, $ano, $banca_id, $orgao_id, $cargo_id, $nivel_id, $tipo_prova_id = null) {
    if (empty($nome)) return null;
    
    // Clean up hyphens
    $nome = str_replace('-', ' ', $nome);
    
    $slug = slugify($nome);
    
    $stmt = $db->prepare("SELECT id FROM provas WHERE slug = :slug OR nome = :nome LIMIT 1");
    $stmt->execute([':slug' => $slug, ':nome' => $nome]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($existing) return $existing['id'];

    $stmt = $db->prepare("INSERT INTO provas (nome, slug, ano, banca_id, orgao_id, cargo_id, nivel_id, tipo_prova_id) VALUES (:nome, :slug, :ano, :banca, :orgao, :cargo, :nivel, :tipo)");
    $stmt->execute([
        ':nome' => $nome,
        ':slug' => $slug,
        ':ano' => $ano ?? date('Y'),
        ':banca' => $banca_id,
        ':orgao' => $orgao_id,
        ':cargo' => $cargo_id,
        ':nivel' => $nivel_id,
        ':tipo' => $tipo_prova_id
    ]);
    return $db->lastInsertId();
}

function mapGranTaxonomies($q) {
    // Heuristics for Nivel and Area
    $rawAreas = [];
    if (!empty($q['areas']) && is_array($q['areas'])) {
        foreach($q['areas'] as $a) $rawAreas[] = $a['descrição'] ?? $a['nome'] ?? '';
    }

    $rawCargos = [];
    if (!empty($q['cargos']) && is_array($q['cargos'])) {
        foreach($q['cargos'] as $c) $rawCargos[] = $c['descrição'] ?? $c['nome'] ?? '';
    }

    // Level detection (Nível = Escolaridade)
    $nivelNome = 'N/A';
    
    // 1. Try from Question Root
    if (!empty($q['escolaridade'])) {
        $nivelNome = is_array($q['escolaridade']) ? ($q['escolaridade']['nome'] ?? $q['escolaridade']['descrição'] ?? 'N/A') : $q['escolaridade'];
    } elseif (!empty($q['nivel']['nome'])) {
        $nivelNome = $q['nivel']['nome'];
    } elseif (!empty($q['nivel_questao'])) {
        $nivelNome = $q['nivel_questao'];
    } elseif (!empty($q['formacao'])) {
        $nivelNome = is_array($q['formacao']) ? ($q['formacao']['nome'] ?? 'N/A') : $q['formacao'];
    }

    // 2. Fallback to Provas array (highly accurate for Gran Cursos)
    if (($nivelNome === 'N/A' || $nivelNome === 'n-a')) {
        if (!empty($q['provas']) && is_array($q['provas'])) {
            $p = $q['provas'][0];
            $nivelNome = $p['nivel']['nome'] ?? $p['nivel'] ?? $p['escolaridade']['nome'] ?? $p['escolaridade'] ?? 'N/A';
        } elseif (!empty($q['prova'])) {
            $p = $q['prova'];
            $nivelNome = $p['nivel']['nome'] ?? $p['nivel'] ?? $p['escolaridade']['nome'] ?? $p['escolaridade'] ?? 'N/A';
        }
        if (is_array($nivelNome)) $nivelNome = $nivelNome['nome'] ?? 'N/A';
    }
    
    if ($nivelNome === 'N/A' && !empty($q['escolaridade_nome'])) $nivelNome = $q['escolaridade_nome'];

    $areaFinal = 'N/A';
    $cargosFinais = [];

    // Detect Nivel if it's accidentally in the 'areas' array
    $filteredAreas = [];
    if (!empty($rawAreas)) {
        foreach ($rawAreas as $a) {
            if (stripos($a, 'Nível') !== false || stripos($a, 'Superior') !== false || stripos($a, 'Médio') !== false || stripos($a, 'Fundamental') !== false) {
                if ($nivelNome === 'N/A') $nivelNome = $a;
            } else {
                $filteredAreas[] = $a;
            }
        }
    }

    // Extract Area from Cargo name if present
    if (!empty($rawCargos)) {
        foreach ($rawCargos as $c) {
            if (preg_match('/(.*?)[\s-]+ÁREA[\s-]+(.*)/i', $c, $matches)) {
                $cargosFinais[] = trim($matches[1]);
                $areaFinal = trim($matches[2]);
            } else {
                $cargosFinais[] = $c;
            }
        }
    }

    if ($areaFinal === 'N/A' && !empty($filteredAreas)) {
        $areaFinal = $filteredAreas[0];
    }

    // Carreiras (Foco)
    $carreiras = [];
    if (!empty($q['carreiras']) && is_array($q['carreiras'])) {
        foreach($q['carreiras'] as $c) $carreiras[] = $c['nome'] ?? $c['descrição'] ?? '';
    }

    // Materia vs Assunto Fallbacks
    $materiaNome = $q['materia_questao'] ?? $q['disciplina']['nome'] ?? 'N/A';
    if ($materiaNome === 'N/A' && !empty($q['materia_nome'])) $materiaNome = $q['materia_nome'];

    $assuntosNomes = [];
    if (!empty($q['assuntos']) && is_array($q['assuntos'])) {
        foreach($q['assuntos'] as $idx => $a) {
            $name = $a['nome'] ?? '';
            if (empty($name)) continue;
            if ($materiaNome === 'N/A' && $idx === 0) $materiaNome = $name;
            else $assuntosNomes[] = $name;
        }
    }
    
    // Extra fallback for Materia/Assunto
    if ($materiaNome === 'N/A' && !empty($q['assunto_questao'])) $materiaNome = $q['assunto_questao'];
    if (empty($assuntosNomes) && !empty($q['assunto_questao']) && $q['assunto_questao'] !== $materiaNome) $assuntosNomes[] = $q['assunto_questao'];

    // Modalidade Fallbacks (Modalidade = Tipo)
    $modalidadeNome = 'N/A';
    if (!empty($q['tipo'])) {
        $modalidadeNome = is_array($q['tipo']) ? ($q['tipo']['nome'] ?? $q['tipo']['descrição'] ?? 'N/A') : $q['tipo'];
    } elseif (!empty($q['modalidade']['nome'])) {
        $modalidadeNome = $q['modalidade']['nome'];
    } 

    if ($modalidadeNome === 'N/A' && !empty($q['tipo_questao'])) $modalidadeNome = $q['tipo_questao'];
    if ($modalidadeNome === 'N/A' && !empty($q['forma'])) $modalidadeNome = $q['forma'];
    
    // Heuristic for Modalidade based on alternatives count
    if ($modalidadeNome === 'N/A' || $modalidadeNome === 'N/A') {
        $alts = $q['itens'] ?? $q['alternativas'] ?? [];
        if (count($alts) === 2) {
            $modalidadeNome = 'Certo/Errado';
        } elseif (count($alts) >= 4) {
            $modalidadeNome = 'Múltipla Escolha';
        }
    }

    // Dificuldade Mapping (raw numeric index)
    $difFinal = $q['dificuldade'] ?? 1;

    // Professor comment and Detailed Analysis
    $teacherComment = $q['comentario_professor'] ?? $q['comentario_texto'] ?? '';
    // If it's an array (rare but possible in some API versions), join it
    if (is_array($teacherComment)) $teacherComment = implode("<br>", $teacherComment);
    
    $detailedComment = $q['resolucao_texto'] ?? $q['texto_resolucao'] ?? $q['analise_detalhada'] ?? '';
    if (is_array($detailedComment)) $detailedComment = implode("<br>", $detailedComment);

    return [
        'nivel' => $nivelNome,
        'area' => $areaFinal,
        'modalidade' => $modalidadeNome,
        'materia' => $materiaNome,
        'assuntos' => $assuntosNomes,
        'cargos' => $cargosFinais,
        'carreiras' => $carreiras,
        'rawAreas' => $rawAreas,
        'filteredAreas' => $filteredAreas,
        'teacherComment' => $teacherComment,
        'detailedComment' => $detailedComment,
        'dificuldade' => $difFinal,
        'imageUrl' => null
    ];
}

// Helper for AI generation within the worker
function callGeminiAI($db, $prompt) {
    try {
        $stmtKey = $db->prepare("SELECT value_json FROM system_settings WHERE key_name = 'geminiApiKey' LIMIT 1");
        $stmtKey->execute();
        $apiKeyRow = $stmtKey->fetch(PDO::FETCH_ASSOC);
        $apiKey = $apiKeyRow['value_json'] ? json_decode($apiKeyRow['value_json']) : getenv('GEMINI_API_KEY');
        
        if (empty($apiKey)) return ["success" => false, "message" => "API Key não configurada."];

    $stmtModel = $db->prepare("SELECT value_json FROM system_settings WHERE key_name = 'geminiModel' LIMIT 1");
    $stmtModel->execute();
    $modelRow = $stmtModel->fetch(PDO::FETCH_ASSOC);
    $model = $modelRow && !empty($modelRow['value_json']) ? json_decode($modelRow['value_json'], true) : null;
    $model = is_string($model) && preg_match('/^gemini-[A-Za-z0-9._-]+$/', $model) === 1 ? $model : 'gemini-3.5-flash';
    $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($model) . ':generateContent?key=' . $apiKey;
        $payload = [
            "contents" => [["role" => "user", "parts" => [["text" => $prompt]]]],
            "generationConfig" => ["temperature" => 0.2, "maxOutputTokens" => 1500]
        ];

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        $response = curl_exec($ch);
        $result = json_decode($response, true);
        curl_close($ch);

        $text = $result['candidates'][0]['content']['parts'][0]['text'] ?? null;
        if (!$text) {
            $msg = $result['error']['message'] ?? "Resposta da IA vazia ou bloqueada por segurança.";
            return ["success" => false, "message" => "AI Error: " . $msg];
        }

        // Clean markdown blocks if present
        $text = preg_replace('/^```json\s*|```\s*$/i', '', trim($text));
        $data = json_decode($text, true);

        if (!$data) {
             return ["success" => false, "message" => "Erro ao decodificar JSON da IA: " . $text];
        }

        return [
            "success" => true,
            "data" => $data
        ];

        // Try to locate JSON in the text
        if (preg_match('/\{.*\}/s', $text, $matches)) {
            $jsonData = json_decode($matches[0], true);
            if ($jsonData) return ["success" => true, "data" => $jsonData];
        }

        return ["success" => false, "message" => "IA não retornou um JSON válido."];
    } catch (Exception $e) {
        return ["success" => false, "message" => $e->getMessage()];
    }
}

/**
 * Normaliza um valor textual salvo em `system_settings.value_json`.
 *
 * @since 1.0.0
 */
function normalizeJsonSettingScalar($value) {
    if ($value === null) {
        return null;
    }

    if (is_string($value)) {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return null;
        }

        $decoded = json_decode($trimmed, true);
        if (json_last_error() === JSON_ERROR_NONE) {
            if (is_string($decoded)) {
                $decoded = trim($decoded);
                return $decoded !== '' ? $decoded : null;
            }

            if (is_array($decoded) && isset($decoded['value']) && is_string($decoded['value'])) {
                $decodedValue = trim($decoded['value']);
                return $decodedValue !== '' ? $decodedValue : null;
            }
        }

        return $trimmed;
    }

    return is_scalar($value) ? trim((string) $value) : null;
}

/**
 * Detecta placeholders ou chaves sabidamente inválidas.
 *
 * @since 1.0.0
 */
function isPlaceholderApiKey($apiKey) {
    $normalized = strtolower(trim((string) $apiKey));
    if ($normalized === '') {
        return true;
    }

    $knownPlaceholders = [
        'your_gemini_api_key',
        'your-api-key-here',
        '123456789',
        'dev-api-key',
        'changeme',
        'test',
    ];

    return in_array($normalized, $knownPlaceholders, true);
}

/**
 * Resolve a chave Gemini priorizando settings válidas e depois `.env`.
 *
 * @since 1.0.0
 */
function resolveGranAiApiKey($db) {
    $stmtKey = $db->prepare("SELECT value_json FROM system_settings WHERE key_name = 'geminiApiKey' LIMIT 1");
    $stmtKey->execute();
    $apiKeyRow = $stmtKey->fetch(PDO::FETCH_ASSOC) ?: [];

    $settingsKey = normalizeJsonSettingScalar($apiKeyRow['value_json'] ?? null);
    if (!empty($settingsKey) && !isPlaceholderApiKey($settingsKey)) {
        return $settingsKey;
    }

    $envKey = trim((string) getenv('GEMINI_API_KEY'));
    if (!empty($envKey) && !isPlaceholderApiKey($envKey)) {
        return $envKey;
    }

    return null;
}

/**
 * Gera comentários locais quando a IA externa não está disponível.
 *
 * @since 1.0.0
 */
function buildGranLocalAiFallback($enunciado, array $alternativas) {
    $normalizedAlternatives = [];
    $correctAlternatives = [];

    foreach ($alternativas as $index => $alt) {
        $letter = chr(65 + $index);
        $text = trim((string) ($alt['texto_alternativa'] ?? $alt['corpo'] ?? $alt['texto'] ?? ''));
        $isCorrect = !empty($alt['is_correto']) || !empty($alt['gabarito']);

        $normalizedAlternatives[] = [
            'letter' => $letter,
            'text' => $text !== '' ? $text : 'Alternativa sem texto disponível.',
            'isCorrect' => $isCorrect,
        ];

        if ($isCorrect) {
            $correctAlternatives[] = $letter;
        }
    }

    $correctLabel = !empty($correctAlternatives)
        ? implode(', ', $correctAlternatives)
        : 'não identificada no payload recebido';

    $teacherComment = '<p>Use esta questão para revisar o comando do enunciado antes de marcar a resposta. O foco aqui é interpretar com calma, eliminar as alternativas inconsistentes e confirmar a opção que respeita integralmente o que foi pedido.</p>';

    if (!empty($correctAlternatives)) {
        $teacherComment .= '<p><strong>Gabarito identificado:</strong> alternativa ' . htmlspecialchars($correctLabel, ENT_QUOTES, 'UTF-8') . '.</p>';
    } else {
        $teacherComment .= '<p><strong>Atenção:</strong> o payload não informou o gabarito. Revise a resposta oficial antes de importar definitivamente.</p>';
    }

    $analysisItems = [];
    foreach ($normalizedAlternatives as $alt) {
        if ($alt['isCorrect']) {
            $analysisItems[] = '<li><strong>' . $alt['letter'] . '.</strong> Esta foi marcada como correta no payload. Confirme se o texto atende exatamente ao comando do enunciado e use-a como referência para revisar o conteúdo.</li>';
            continue;
        }

        $analysisItems[] = '<li><strong>' . $alt['letter'] . '.</strong> Releia esta alternativa comparando cada termo com o comando do enunciado. Se houver exagero, restrição indevida ou mudança de contexto, trate isso como indício de erro.</li>';
    }

    if (empty($analysisItems)) {
        $analysisItems[] = '<li>Não foi possível montar a análise das alternativas porque o payload chegou sem itens utilizáveis.</li>';
    }

    $detailedComment = '<p><strong>Estratégia de resolução:</strong> destaque palavras-chave do enunciado, valide o tema central cobrado e só então compare as alternativas.</p>';
    $detailedComment .= '<ul>' . implode('', $analysisItems) . '</ul>';
    $detailedComment .= '<p><strong>Checklist final:</strong> confirme o comando da banca, elimine opções incompatíveis e valide o gabarito antes de salvar a questão.</p>';

    return [
        'success' => true,
        'data' => [
            'teacherComment' => $teacherComment,
            'detailedComment' => $detailedComment,
            'source' => 'local_fallback',
        ],
        'fallback' => true,
        'message' => 'Comentário gerado localmente porque a IA externa não está configurada ou não respondeu de forma válida.',
    ];
}

/**
 * Resolve comentários da questão usando Gemini quando disponível e fallback local quando necessário.
 *
 * @since 1.0.0
 */
function generateGranAiComments($db, $prompt, $enunciado, array $alternativas) {
    $apiKey = resolveGranAiApiKey($db);
    if (empty($apiKey)) {
        return buildGranLocalAiFallback($enunciado, $alternativas);
    }

    $result = callGeminiAI($db, $prompt);
    if (!empty($result['success']) && !empty($result['data'])) {
        $result['data']['source'] = $result['data']['source'] ?? 'gemini';
        return $result;
    }

    error_log('Gran AI fallback: ' . ($result['message'] ?? 'falha desconhecida'));
    return buildGranLocalAiFallback($enunciado, $alternativas);
}

// Helper to save image locally
function saveImageLocally($url) {
    if (empty($url)) return null;

    // Use absolute path relative to the script's root for maximum reliability
    $rootPath = realpath(__DIR__ . '/../../../../');
    $uploadsDir = $rootPath . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'questions';
    
    if (!is_dir($uploadsDir)) {
        if (!mkdir($uploadsDir, 0777, true)) {
            error_log("Scraper Error: Falha ao criar diretório $uploadsDir");
            return null;
        }
    }

    if (!is_writable($uploadsDir)) {
        error_log("Scraper Error: Diretório não possui permissão de escrita: $uploadsDir");
        return null;
    }

    $extension = pathinfo(parse_url($url, PHP_URL_PATH), PATHINFO_EXTENSION) ?: 'png';
    $filename = md5($url) . '.' . $extension;
    $filepath = $uploadsDir . DIRECTORY_SEPARATOR . $filename;

    if (!file_exists($filepath)) {
        error_log("Scraper: Iniciando download da imagem: $url");
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); 
        $data = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = curl_error($ch);
        curl_close($ch);

        if ($httpCode === 200 && !empty($data)) {
            $bytes = file_put_contents($filepath, $data);
            if ($bytes === false) {
                error_log("Scraper Error: Falha ao gravar arquivo em $filepath");
                return null;
            }
            error_log("Scraper Success: Imagem salva ($bytes bytes) em $filepath");
        } else {
            error_log("Scraper Error: Falha no download. HTTP: $httpCode, CURL: $curlErr, URL: $url");
            return null;
        }
    }

    return 'uploads/questions/' . $filename;
}

// Global helper to process HTML content and localize images
function processContentImages($html, $hasImageFlag, $granId) {
    if (empty($html)) return $html;
    $granBaseUrl = GRAN_FILES_BASE_URL;
    
    // 1. Fix relative paths (handles src="/imagem/..." with " or ')
    $html = preg_replace_callback('/src\s*=\s*([\'"])\/imagem\//i', function($m) use ($granBaseUrl) {
        return 'src=' . $m[1] . $granBaseUrl . '/imagem/';
    }, $html);
    
    // 2. Find all images pointing to Gran Cursos storage (handles both quotes)
    preg_match_all('/src\s*=\s*([\'"])(https:\/\/arquivos\.infra-questoes\.grancursosonline\.com\.br\/[^\1]+?)\1/i', $html, $matches);
    
    $found = false;
    if (!empty($matches[2])) {
        foreach ($matches[2] as $externalUrl) {
            $localPath = saveImageLocally($externalUrl);
            if ($localPath) {
                $localPath = ltrim($localPath, '/');
                $html = str_replace($externalUrl, $localPath, $html);
                $found = true;
            }
        }
    }
    
    if ($hasImageFlag && !$found && (strpos($html, '<img') !== false)) {
         error_log("Scraper Warning: Questão $granId tem hasImage=true e possui <img> mas regex falhou em capturar a URL.");
    }
    
    return $html;
}

// Helper to get or create a question group
function getOrCreateQuestionGroup($db, $groupData) {
    if (empty($groupData) || (empty($groupData['id']) && empty($groupData['gran_id']))) return null;
    
    $granId = $groupData['id'] ?? $groupData['gran_id'];
    
    $stmt = $db->prepare("SELECT id FROM questions_groups WHERE id = :gid LIMIT 1");
    $stmt->execute([':gid' => $granId]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($existing) return $existing['id'];
    
    // Localization of group image
    $imgUrl = '';
    if (!empty($groupData['arquivo'])) {
        $path = is_array($groupData['arquivo']) ? ($groupData['arquivo']['caminho'] ?? '') : $groupData['arquivo'];
        if (!empty($path)) {
            $fullUrl = buildGranAssetUrl($path);
            $imgUrl = saveImageLocally($fullUrl);
        }
    } elseif (!empty($groupData['caminho_arquivo'])) {
        $fullUrl = buildGranAssetUrl($groupData['caminho_arquivo']);
        $imgUrl = saveImageLocally($fullUrl);
    }
    
    // Localization of images inside group texts
    $enunciado = $groupData['enunciado'] ?? '';
    $texto = $groupData['texto'] ?? '';
    $enunciadoClean = $groupData['enunciado_clean'] ?? strip_tags($enunciado);

    $enunciado = processContentImages($enunciado, !empty($imgUrl), "Group-$granId-E");
    $texto = processContentImages($texto, !empty($imgUrl), "Group-$granId-T");
    
    // Final validation: Only create the group if it has relevant content
    // We check for text (stripped of tags) or the presence of images
    $hasText = !empty(trim(strip_tags($enunciado))) || !empty(trim(strip_tags($texto)));
    $hasDirectImage = !empty($imgUrl);
    $hasInlineImages = (strpos($enunciado, '<img') !== false) || (strpos($texto, '<img') !== false);

    if (!$hasText && !$hasDirectImage && !$hasInlineImages) {
        return null;
    }

    try {
        $stmt = $db->prepare("INSERT INTO questions_groups (id, enunciado, enunciado_clean, texto, image_url) VALUES (:gid, :enunciado, :clean, :texto, :img)");
        $stmt->execute([
            ':gid' => $granId,
            ':enunciado' => $enunciado,
            ':clean' => $enunciadoClean,
            ':texto' => $texto,
            ':img' => $imgUrl
        ]);
        return $granId;
    } catch (Exception $e) {
        error_log("Scraper Error: Falha ao salvar grupo de questão: " . $e->getMessage());
        return null;
    }
}

try {
    $database = new Database();
    $db = $database->getConnection();

    $input = json_decode(file_get_contents("php://input"), true);
    
    $action = $input['action'] ?? 'fetch'; // 'fetch' or 'save'
    $token = trim((string) ($input['token'] ?? ''));
    $page = (int)($input['page'] ?? 1);
    $perPage = (int)($input['perPage'] ?? 20);
    $anoFilter = $input['ano'] ?? '';
    $directUrl = trim((string) ($input['url'] ?? ''));

    if (empty($token) && $action === 'fetch') {
        echo json_encode(['success' => false, 'message' => 'Token nao fornecido.', 'http_code' => 0]);
        exit;
    }

    if ($action === 'fetch') {
        if (isGranTokenExpired($token)) {
            $expiration = getGranTokenExpiration($token);
            echo json_encode([
                'success' => false,
                'message' => 'Bearer expirado. Gere um novo token na Gran antes de buscar as questoes.',
                'http_code' => 401,
                'token_expired' => true,
                'token_expires_at' => $expiration ? gmdate('c', $expiration) : null,
            ]);
            exit;
        }

        $apiUrl = $directUrl !== '' ? $directUrl : buildGranQuestionsApiUrl($page, $perPage, $anoFilter);
        $requestResult = performGranApiRequest($apiUrl, $token);
        $response = $requestResult['response'];
        $httpCode = $requestResult['http_code'];
        $curlError = $requestResult['curl_error'];

        if ($response === false || $curlError !== '') {
            echo json_encode([
                'success' => false,
                'message' => 'Falha ao consultar a API da Gran.',
                'http_code' => $httpCode,
                'curl_error' => $curlError,
                'request_url' => $apiUrl,
            ]);
            exit;
        }

        if ($httpCode !== 200) {
            $decodedError = json_decode($response, true);
            $remoteMessage = $decodedError['message']['text'] ?? $decodedError['message'] ?? null;

            echo json_encode([
                'success' => false,
                'message' => $remoteMessage ?: "Erro na API Gran: HTTP {$httpCode}",
                'http_code' => $httpCode,
                'raw_response' => $response,
                'request_url' => $apiUrl,
            ]);
            exit;
        }

        $data = json_decode($response, true);
        if (!is_array($data)) {
            echo json_encode([
                'success' => false,
                'message' => 'A API da Gran respondeu com JSON invalido.',
                'http_code' => $httpCode,
                'raw_response' => $response,
                'request_url' => $apiUrl,
            ]);
            exit;
        }
        
        // Structure check: data.rows vs itens
        $questions = [];
        if (isset($data['data']['rows'])) {
            $questions = $data['data']['rows'];
        } elseif (isset($data['itens'])) {
            $questions = $data['itens'];
        }
        
        $results = [];
        foreach ($questions as $q) {
            $granId = $q['id_questao'] ?? $q['id'] ?? null;
            if (!$granId) continue;

            // Generate content-based hash for robust de-duplication
            $enunciadoForHash = $q['enunciado'] ?? $q['texto_questao'] ?? '';
            $altsForHash = $q['itens'] ?? $q['alternativas'] ?? [];
            $hashId = md5($enunciadoForHash . json_encode($altsForHash));
            
            // Check if exists
            $stmtCheck = $db->prepare("SELECT id FROM questions WHERE hash_id = :hash LIMIT 1");
            $stmtCheck->execute([':hash' => $hashId]);
            $exists = $stmtCheck->fetch() ? true : false;
            
            // Mapping improvements based on screenshot
            $bancaNome = 'N/A';
            if (!empty($q['bancas']) && is_array($q['bancas'])) {
                $b = $q['bancas'][0];
                $bancaNome = (!empty($b['sigla'])) ? $b['sigla'] : ($b['nome'] ?? 'N/A');
            }

            $orgaoNome = 'N/A';
            if (!empty($q['orgaos']) && is_array($q['orgaos'])) {
                $orgaoNome = $q['orgaos'][0]['nome'] ?? 'N/A';
            }

            $anoValue = 'N/A';
            if (!empty($q['anos']) && is_array($q['anos'])) {
                $anoValue = $q['anos'][0];
            } elseif (!empty($q['ano'])) {
                $anoValue = $q['ano'];
            }
            
            // Enhanced taxonomies mapping via helper
            $tax = mapGranTaxonomies($q);

            // Image detection
            $imageUrl = '';
            if (!empty($q['arquivo'])) {
                $img = is_array($q['arquivo']) ? ($q['arquivo']['caminho'] ?? '') : $q['arquivo'];
                if (!empty($img)) {
                    $imageUrl = buildGranAssetUrl($img);
                }
            }
            if (empty($imageUrl) && !empty($q['imagens']) && is_array($q['imagens'])) {
                $img = $q['imagens'][0]['caminho'] ?? '';
                if (!empty($img)) {
                    $imageUrl = buildGranAssetUrl($img);
                }
            }
            $tax['imageUrl'] = $imageUrl;

            // alternatives from 'itens'
            $altsRaw = $q['itens'] ?? $q['alternativas'] ?? [];
            $mappedAlts = [];
            $correctResId = $q['resposta'] ?? null;

            foreach ($altsRaw as $a) {
                $mappedAlts[] = [
                    'id' => $a['id'] ?? null,
                    'texto_alternativa' => $a['corpo'] ?? $a['texto_alternativa'] ?? '',
                    'is_correto' => ($correctResId && isset($a['id']) && $a['id'] == $correctResId) ? true : (isset($a['is_correto']) ? $a['is_correto'] : false)
                ];
            }

            // Content separation: texto_questao vs enunciado
            $introText = '';
            if (!empty($q['textos_questao']) && is_array($q['textos_questao'])) {
                $introTexts = [];
                foreach ($q['textos_questao'] as $tx) {
                    if (!empty($tx['texto'])) $introTexts[] = $tx['texto'];
                }
                $introText = implode("<br><br>", $introTexts);
            } elseif (!empty($q['texto_questao'])) {
                $introText = $q['texto_questao'];
            }

            $enunciadoFinal = $q['enunciado'] ?? $q['texto_questao'] ?? 'Sem enunciado';
            
            $enunciadoFinal = $q['enunciado'] ?? $q['texto_questao'] ?? 'Sem enunciado';
            
            // Fix relative images and download ALL images (inline and standalone)
            $hasImageFlag = !empty($q['possui_imagem']) || !empty($q['hasImage']);

            $introText = processContentImages($introText, $hasImageFlag, $granId);
            $enunciadoFinal = processContentImages($enunciadoFinal, $hasImageFlag, $granId);

            // If introText is exactly the same as enunciado, don't duplicate
            if (trim(strip_tags($introText)) === trim(strip_tags($enunciadoFinal))) {
                $introText = '';
            }

            $results[] = [
                'granId' => $granId,
                'hashId' => $hashId,
                'introText' => $introText,
                'enunciado' => $enunciadoFinal,
                'banca' => $bancaNome,
                'orgao' => $orgaoNome,
                'ano' => $anoValue,
                'materia' => $tax['materia'],
                'nivel' => $tax['nivel'],
                'modalidade' => $tax['modalidade'],
                'area' => $tax['area'],
                'cargos' => array_unique($tax['cargos']),
                'carreiras' => array_unique($tax['carreiras']),
                'areas' => array_unique($tax['filteredAreas']),
                'assuntos' => array_unique($tax['assuntos']),
                'teacherComment' => $tax['teacherComment'],
                'detailedComment' => $tax['detailedComment'],
                'dificuldade' => $tax['dificuldade'],
                'imageUrl' => $tax['imageUrl'],
                'alternativas' => $mappedAlts,
                'is_anulada' => $q['anulada'] ?? $q['is_anulada'] ?? false,
                'is_desatualizada' => $q['desatualizada'] ?? $q['is_desatualizada'] ?? false,
                'exists' => $exists,
                'grupoQuestao' => $q['grupo_questao'] ?? $q['grupoQuestao'] ?? null,
                'raw' => $q
            ];
        }

        echo json_encode([
            'success' => true,
            'questions' => $results,
            'page' => $page,
            'totalInPage' => count($results),
            'totalQuestions' => $data['data']['total'] ?? $data['total'] ?? 0,
            'totalPages' => $data['data']['pages'] ?? $data['data']['totalPaginas'] ?? $data['pages'] ?? 1,
            'http_code' => $httpCode,
            'request_url' => $apiUrl,
            'token_expires_at' => ($expiration = getGranTokenExpiration($token)) ? gmdate('c', $expiration) : null,
            'debug_raw' => $data // Full decoded data for inspection
        ]);
        exit;
    }

    if ($action === 'save') {
        $questionsToSave = $input['questions'] ?? [];
        $imported = 0;
        $skipped = 0;
        $errors = [];

        foreach ($questionsToSave as $q) {
            $granId = $q['id_questao'] ?? $q['id'] ?? null;
            if (!$granId) continue;
            
            // Content-based hash as requested
            $enunciadoForHash = $q['enunciado'] ?? $q['texto_questao'] ?? '';
            $altsRaw = $q['itens'] ?? $q['alternativas'] ?? $q['alternativas_questao'] ?? [];
            $hashId = md5($enunciadoForHash . json_encode($altsRaw));

            // Check if exists again to be safe
            $stmtCheck = $db->prepare("SELECT id FROM questions WHERE hash_id = :hash LIMIT 1");
            $stmtCheck->execute([':hash' => $hashId]);
            if ($stmtCheck->fetch()) {
                $skipped++;
                continue;
            }
            try {
                // Process alternatives (using the raw data from Gran)
                $altsRaw = $q['itens'] ?? $q['alternativas'] ?? $q['alternativas_questao'] ?? [];
                $alternativas = [];
                $correctIndex = 0;
                $alphabet = range('A', 'Z');
                $correctResId = $q['resposta'] ?? null;
                
                foreach ($altsRaw as $idx => $alt) {
                    // Use real ID from Gran or a high-offset ID to avoid collision with indices (0, 1, 2, 3...)
                    $altId = $alt['id'] ?? ($idx + 1000);
                    
                    $alternativas[] = [
                        'id' => $altId,
                        'rotulo' => $alphabet[$idx] ?? $idx,
                        'corpo' => $alt['corpo'] ?? $alt['texto_alternativa'] ?? ''
                    ];
                    
                    // Identify correct answer by ID comparison (resposta field)
                    if (($correctResId && isset($alt['id']) && $alt['id'] == $correctResId) || 
                        !empty($alt['is_correto']) || !empty($alt['gabarito'])) {
                        $correctIndex = $idx;
                    }
                }

                // Content separation for save
                $introTextSave = '';
                if (!empty($q['textos_questao']) && is_array($q['textos_questao'])) {
                    $introTexts = [];
                    foreach ($q['textos_questao'] as $tx) {
                        if (!empty($tx['texto'])) $introTexts[] = $tx['texto'];
                    }
                    $introTextSave = implode("<br><br>", $introTexts);
                } elseif (!empty($q['texto_questao'])) {
                    $introTextSave = $q['texto_questao'];
                }

                $enunciadoSave = $q['enunciado'] ?? $q['texto_questao'] ?? '';
                
                // Localize inline images in save action too!
                $hasImageFlagSave = !empty($q['possui_imagem']) || !empty($q['hasImage']);
                $introTextSave = processContentImages($introTextSave, $hasImageFlagSave, $granId);
                $enunciadoSave = processContentImages($enunciadoSave, $hasImageFlagSave, $granId);

                if (trim(strip_tags($introTextSave)) === trim(strip_tags($enunciadoSave))) {
                    $introTextSave = '';
                }

                // Handle Question Group
                $grupoQuestaoId = null;
                $groupRaw = $q['grupoQuestao'] ?? $q['grupo_questao'] ?? null;
                if ($groupRaw) {
                    $grupoQuestaoId = getOrCreateQuestionGroup($db, $groupRaw);
                }

                // Download and save image locally if exists
                $localImageUrl = '';
                if (!empty($q['imageUrl'])) {
                    error_log("Scraper: Question ID {$granId} possui imagem: " . $q['imageUrl']);
                    $localImageUrl = saveImageLocally($q['imageUrl']);
                    error_log("Scraper: Retorno do saveImageLocally: " . ($localImageUrl ?: "FALHOU"));
                }

                $dataJson = json_encode([
                    'itens' => $alternativas,
                    'introText' => $introTextSave,
                    'imageUrl' => $localImageUrl ?: ($q['imageUrl'] ?? ''),
                    'teacherComment' => $q['teacherComment'] ?? '',
                    'detailedComment' => $q['detailedComment'] ?? ''
                ], JSON_UNESCAPED_UNICODE);

                $tipo = (count($alternativas) == 2 && ($alternativas[0]['corpo'] == 'Certo' || $alternativas[0]['corpo'] == 'Errado')) ? 'certo_errado' : 'multipla_escolha';

                $stmt = $db->prepare("
                    INSERT INTO questions (
                        hash_id, enunciado, enunciado_clean, intro_text, tipo, dificuldade, anulada, desatualizada, 
                        resolvida_por_prof, resposta_correta_item_index, data_json, teacher_comment, 
                        detailed_comment, prova_id, grupo_questao_id, created_at
                    ) VALUES (
                        :hash, :enunciado, :clean, :intro, :tipo, :dif, :anulada, :desat, 
                        :prof, :resp, :json, :tcomm, 
                        :dcomm, :prova, :grupo, NOW()
                    )
                ");
                
                // --- PROVA LINKING ---
                $tax = mapGranTaxonomies($q);
                
                $bancaId = null;
                if (!empty($q['bancas'])) {
                    $b = $q['bancas'][0];
                    $bancaId = getOrCreateFilter($db, 'banca', (!empty($b['sigla']) ? $b['sigla'] : ($b['nome'] ?? 'N/A')));
                }
                
                $orgaoId = null;
                if (!empty($q['orgaos']) && is_array($q['orgaos'])) {
                    $orgaoId = getOrCreateFilter($db, 'orgao', $q['orgaos'][0]['nome'] ?? 'N/A');
                }
                
                $tipoProvaId = null;
                $rawTipoProva = $q['prova']['tipo_prova']['nome'] ?? $q['tipo_prova_nome'] ?? null;
                if ($rawTipoProva) {
                    $tipoProvaId = getOrCreateFilter($db, 'tipo_prova', $rawTipoProva);
                }
                
                $cargoId = null;
                if (!empty($tax['cargos'])) {
                    $cargoId = getOrCreateFilter($db, 'cargo', $tax['cargos'][0]);
                }

                $nivelId = getOrCreateFilter($db, 'nivel', $tax['nivel']);
                
                $anoProva = $q['anos'][0] ?? $q['ano'] ?? date('Y');
                
                $multipleOrgaosString = '';
                if (!empty($q['orgaos']) && is_array($q['orgaos'])) {
                    $orgaNames = array_map(fn($o) => $o['nome'] ?? '', $q['orgaos']);
                    $orgaNames = array_filter($orgaNames);
                    $multipleOrgaosString = implode(" / ", $orgaNames);
                } else {
                    $multipleOrgaosString = $q['orgaos'][0]['nome'] ?? '';
                }

                $provaNome = $q['prova']['nome'] ?? "Prova " . $multipleOrgaosString . " " . ($tax['cargos'][0] ?? '') . " " . $anoProva;
                
                $provaId = getOrCreateProva($db, $provaNome, $anoProva, $bancaId, $orgaoId, $cargoId, $nivelId, $tipoProvaId);
                // ---------------------

                $stmt->execute([
                    ':hash' => $hashId,
                    ':enunciado' => $enunciadoSave,
                    ':clean' => trim(strip_tags($enunciadoSave)),
                    ':intro' => $introTextSave,
                    ':tipo' => $tipo,
                    ':dif' => $tax['dificuldade'],
                    ':anulada' => (!empty($q['anulada']) || !empty($q['is_anulada'])) ? 1 : 0,
                    ':desat' => (!empty($q['desatualizada']) || !empty($q['is_desatualizada'])) ? 1 : 0,
                    ':prof' => 0,
                    ':resp' => $correctIndex,
                    ':json' => $dataJson,
                    ':tcomm' => $q['teacherComment'] ?? $tax['teacherComment'],
                    ':dcomm' => $q['detailedComment'] ?? $tax['detailedComment'],
                    ':prova' => $provaId,
                    ':grupo' => $grupoQuestaoId
                ]);
                
                $questionId = $db->lastInsertId();

                $filtersToLink = [];
                
                // Advanced taxonomies heuristics for SAVE via shared helper
                $tax = mapGranTaxonomies($q);

                // Banca
                if (!empty($q['bancas']) && is_array($q['bancas'])) {
                    foreach ($q['bancas'] as $b) {
                        $name = (!empty($b['sigla'])) ? $b['sigla'] : ($b['nome'] ?? '');
                        $desc = (!empty($b['sigla']) && !empty($b['nome'])) ? $b['nome'] : null;
                        if (!empty($name)) $filtersToLink[] = getOrCreateFilter($db, 'banca', $name, $desc);
                    }
                }

                // Orgao
                if (!empty($q['orgaos']) && is_array($q['orgaos'])) {
                    foreach ($q['orgaos'] as $o) {
                        if (!empty($o['nome'])) $filtersToLink[] = getOrCreateFilter($db, 'orgao', $o['nome']);
                    }
                }

                // Ano
                $anoVal = null;
                if (!empty($q['anos']) && is_array($q['anos'])) {
                    $anoVal = $q['anos'][0];
                } elseif (!empty($q['ano'])) {
                    $anoVal = $q['ano'];
                }
                if ($anoVal) $filtersToLink[] = getOrCreateFilter($db, 'ano', $anoVal);
                
                // Cargos (Heuristic ones)
                if (!empty($tax['cargos'])) {
                    foreach ($tax['cargos'] as $cfS) {
                        if (!empty($cfS)) $filtersToLink[] = getOrCreateFilter($db, 'cargo', $cfS);
                    }
                }

                // Área (Heuristic one)
                if (!empty($tax['area']) && $tax['area'] !== 'N/A') {
                    $filtersToLink[] = getOrCreateFilter($db, 'area', $tax['area']);
                }

                // Carreiras (Foco na UI)
                if (!empty($tax['carreiras'])) {
                    foreach ($tax['carreiras'] as $c) {
                        if (!empty($c)) $filtersToLink[] = getOrCreateFilter($db, 'carreira', $c);
                    }
                }

                // Areas Extras (not the ones used in heuristic if possible)
                if (!empty($tax['filteredAreas'])) {
                    foreach ($tax['filteredAreas'] as $ra) {
                        if ($ra !== $tax['area'] && $ra !== $tax['nivel']) {
                            $filtersToLink[] = getOrCreateFilter($db, 'area', $ra);
                        }
                    }
                }

                // Matéria filter
                if (!empty($tax['materia']) && $tax['materia'] !== 'N/A') {
                    $filtersToLink[] = getOrCreateFilter($db, 'assunto', $tax['materia']);
                }

                // Assuntos
                if (!empty($tax['assuntos'])) {
                    foreach ($tax['assuntos'] as $asS) {
                        if (!empty($asS)) $filtersToLink[] = getOrCreateFilter($db, 'assunto', $asS);
                    }
                }

                // Nivel
                if (!empty($tax['nivel']) && $tax['nivel'] !== 'N/A') {
                    $filtersToLink[] = getOrCreateFilter($db, 'nivel', $tax['nivel']);
                }

                // Modalidade
                if (!empty($tax['modalidade']) && $tax['modalidade'] !== 'N/A') {
                    $filtersToLink[] = getOrCreateFilter($db, 'modalidade', $tax['modalidade']);
                }

                // Tipo de Prova
                if ($tipoProvaId) {
                    $filtersToLink[] = $tipoProvaId;
                }

                foreach (array_unique(array_filter($filtersToLink)) as $filterId) {
                    $stmtLink = $db->prepare("INSERT IGNORE INTO question_filters (question_id, filter_id) VALUES (:qid, :fid)");
                    $stmtLink->execute([':qid' => $questionId, ':fid' => $filterId]);
                }

                $imported++;
            } catch (Exception $e) {
                $errors[] = "Questão {$granId}: " . $e->getMessage();
            }
        }

        echo json_encode([
            'success' => true,
            'imported' => $imported,
            'skipped' => $skipped,
            'errors' => $errors
        ]);
        exit;
    }

    if ($action === 'generate_ai') {
        $enunciado = $input['enunciado'] ?? '';
        $alternativas = $input['alternativas'] ?? [];
        
        if (empty($enunciado)) {
            echo json_encode(['success' => false, 'message' => 'Enunciado vazio.']);
            exit;
        }

        $altsText = "";
        foreach ($alternativas as $idx => $alt) {
            $marker = chr(65 + $idx);
            $texto = $alt['texto_alternativa'] ?? $alt['corpo'] ?? '';
            $altsText .= "($marker) $texto\n";
        }

        $prompt = "Você é um professor especialista em concursos públicos. Análise a seguinte questão:\n\n";
        $prompt .= "Enunciado:\n$enunciado\n\n";
        $prompt .= "Alternativas:\n$altsText\n\n";
        $prompt .= "Gere:\n";
        $prompt .= "1. Um Comentário do Professor (pedagógico, direto ao ponto e motivador).\n";
        $prompt .= "2. Uma Análise Detalhada (explicando por que a correta é a correta e o erro exato de cada uma das outras).\n\n";
        $prompt .= "RESPONDA APENAS EM FORMATO JSON com as chaves: 'teacherComment' (string HTML) e 'detailedComment' (string HTML). Não use markdown fora do JSON.";

        $result = generateGranAiComments($db, $prompt, $enunciado, $alternativas);
        echo json_encode($result);
        exit;
    }

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>
