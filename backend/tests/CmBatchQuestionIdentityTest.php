<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/ingestion/domain/CmBatchQuestionIdentity.php';

function cmBatchIdentityAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$contexts = [['tempId' => 'ctx1', 'body' => '<p>Contexto comum</p>']];
$base = [
    'type' => 'single_choice',
    'hash' => 'untrusted-repeated-source-hash',
    'source' => ['provider' => 'gran', 'externalId' => 'external-1', 'contextTempId' => 'ctx1'],
    'content' => ['statement' => '<p>Marque &lt; 5 ou &gt; 3.</p>', 'supportText' => '', 'reference' => ''],
    'assets' => [['path' => 'assets/image.png']],
    'alternatives' => [
        ['order' => 1, 'label' => 'A', 'text' => '<p>Primeira</p>'],
        ['order' => 2, 'label' => 'B', 'text' => '<p>Segunda</p>'],
    ],
    'answer' => ['raw' => 'A'],
];
$assetHashes = ['assets/image.png' => str_repeat('a', 64)];
$first = CmBatchQuestionIdentity::fingerprint($base, $contexts, $assetHashes);
$sameContentDifferentOrigin = $base;
$sameContentDifferentOrigin['source'] = ['provider' => 'other', 'externalId' => 'another-id', 'contextTempId' => 'ctx1'];
$sameContentDifferentOrigin['answer'] = ['raw' => 'B'];
$sameContentDifferentOrigin['hash'] = 'different-untrusted-hash';
$same = CmBatchQuestionIdentity::fingerprint($sameContentDifferentOrigin, $contexts, $assetHashes);
cmBatchIdentityAssert(hash_equals($first, $same), 'Origem e gabarito da ocorrencia nao devem alterar identidade do conteudo canonico.');

$differentOrder = $base;
$differentOrder['alternatives'][0]['order'] = 2;
$differentOrder['alternatives'][1]['order'] = 1;
cmBatchIdentityAssert(
    !hash_equals($first, CmBatchQuestionIdentity::fingerprint($differentOrder, $contexts, $assetHashes)),
    'A ordem das alternativas deve fazer parte do fingerprint.'
);

$differentContext = $contexts;
$differentContext[0]['body'] = '<p>Outro contexto</p>';
cmBatchIdentityAssert(
    !hash_equals($first, CmBatchQuestionIdentity::fingerprint($base, $differentContext, $assetHashes)),
    'Contexto que altera sentido nao pode compartilhar fingerprint.'
);

$differentImage = $assetHashes;
$differentImage['assets/image.png'] = str_repeat('b', 64);
cmBatchIdentityAssert(
    !hash_equals($first, CmBatchQuestionIdentity::fingerprint($base, $contexts, $differentImage)),
    'Imagem distinta deve produzir fingerprint distinto.'
);

$normalizedMarkup = $base;
$normalizedMarkup['content']['statement'] = "  <div>Marque &lt; 5 ou &gt; 3.</div>  ";
cmBatchIdentityAssert(
    hash_equals($first, CmBatchQuestionIdentity::fingerprint($normalizedMarkup, $contexts, $assetHashes)),
    'Tags irrelevantes e whitespace nao devem alterar fingerprint.'
);

$forgedHash = $base;
$forgedHash['assets'][0]['sha256'] = str_repeat('f', 64);
cmBatchIdentityAssert(
    hash_equals($first, CmBatchQuestionIdentity::fingerprint($forgedHash, $contexts, $assetHashes)),
    'Hash fornecido no anexo nao pode substituir o hash binario verificado.'
);
foreach ([[$base, [], $assetHashes], [$forgedHash, $contexts, []]] as [$question, $availableContexts, $verifiedAssets]) {
    $rejected = false;
    try {
        CmBatchQuestionIdentity::fingerprint($question, $availableContexts, $verifiedAssets);
    } catch (InvalidArgumentException $error) {
        $rejected = true;
    }
    cmBatchIdentityAssert($rejected, 'Contexto ou midia ausente deve bloquear a identidade canonica.');
}

$power = $base;
$power['content']['statement'] = 'Calcule 2<sup>3</sup>.';
$plainNumber = $base;
$plainNumber['content']['statement'] = 'Calcule 23.';
cmBatchIdentityAssert(
    CmBatchQuestionIdentity::fingerprint($power,$contexts,$assetHashes) !== CmBatchQuestionIdentity::fingerprint($plainNumber,$contexts,$assetHashes),
    'Expoente nao pode ser confundido com digitos na mesma linha.'
);
$inline = $base;
$literalMarkers = $power;
$literalMarkers['content']['statement'] = 'Calcule 2[sup]3[/sup].';
cmBatchIdentityAssert(
    CmBatchQuestionIdentity::fingerprint($power,$contexts,$assetHashes) !== CmBatchQuestionIdentity::fingerprint($literalMarkers,$contexts,$assetHashes),
    'Texto literal nao pode imitar marcadores estruturais.'
);
$table = $base;
$table['content']['statement'] = '<table><tr><td colspan="2">X</td></tr></table>';
$otherTable = $table;
$otherTable['content']['statement'] = '<table><tr><td colspan="3">X</td></tr></table>';
cmBatchIdentityAssert(
    CmBatchQuestionIdentity::fingerprint($table,$contexts,$assetHashes) !== CmBatchQuestionIdentity::fingerprint($otherTable,$contexts,$assetHashes),
    'Estrutura de tabela distinta nao pode ser descartada.'
);
$inline['content']['statement'] = 'Observe <img src="assets/image.png">.';
cmBatchIdentityAssert(
    CmBatchQuestionIdentity::fingerprint($inline,$contexts,$assetHashes) !== CmBatchQuestionIdentity::fingerprint($inline,$contexts,$differentImage),
    'Imagem inline deve contribuir para a identidade.'
);
$inline['content']['statement'] = '<img src="https://example.invalid/missing.png">';
try {
    CmBatchQuestionIdentity::fingerprint($inline,$contexts,$assetHashes);
    throw new RuntimeException('Imagem inline externa foi ignorada.');
} catch (InvalidArgumentException) {}

$sameAssetHash = str_repeat('c', 64);
$imageQuestionA = [
    'type'=>'single_choice',
    'content'=>['statement'=>'Veja [image:temporary-a].'],
    'assets'=>[['tempId'=>'temporary-a','url'=>'https://gran.invalid/image/23.gif']],
    'alternatives'=>[['order'=>1,'label'=>'A','text'=>'Resposta']],
];
$imageQuestionB = $imageQuestionA;
$imageQuestionB['content']['statement']='Veja [image:temporary-b].';
$imageQuestionB['assets'][0]=['tempId'=>'temporary-b','url'=>'https://gran.invalid/image/23.gif'];
$verifiedImageUrl=['https://gran.invalid/image/23.gif'=>$sameAssetHash];
cmBatchIdentityAssert(
    hash_equals(CmBatchQuestionIdentity::fingerprint($imageQuestionA,[],$verifiedImageUrl),CmBatchQuestionIdentity::fingerprint($imageQuestionB,[],$verifiedImageUrl)),
    'IDs temporarios distintos devem convergir somente pelo mesmo hash binario verificado.'
);
$differentImageBytes=$verifiedImageUrl;
$differentImageBytes['https://gran.invalid/image/23.gif']=str_repeat('d',64);
cmBatchIdentityAssert(
    !hash_equals(CmBatchQuestionIdentity::fingerprint($imageQuestionA,[],$verifiedImageUrl),CmBatchQuestionIdentity::fingerprint($imageQuestionA,[],$differentImageBytes)),
    'Conteudo binario distinto deve manter identidades diferentes.'
);
try {
    CmBatchQuestionIdentity::fingerprint($imageQuestionA,[],[]);
    throw new RuntimeException('Marcador com URL sem binario validado foi aceito.');
} catch (InvalidArgumentException) {}

echo "CmBatchQuestionIdentityTest: PASS\n";
