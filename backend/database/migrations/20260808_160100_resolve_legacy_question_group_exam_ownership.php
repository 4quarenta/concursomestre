<?php

declare(strict_types=1);

/**
 * Completa o vinculo de grupos legados que ja possuem uma copia canonica
 * identica e vinculada a uma unica prova.
 *
 * A atualizacao e deliberadamente conservadora: somente corpos com uma unica
 * prova candidata sao aproveitados; casos ambiguos continuam sem alteracao.
 */
return static function (PDO $db): void {
    $db->exec(
        'UPDATE questions_groups g '
        . 'INNER JOIN ( '
        . '  SELECT legacy.id, MIN(c.prova_id) AS prova_id '
        . '  FROM questions_groups legacy '
        . '  INNER JOIN question_contexts c '
        . "    ON MD5(TRIM(c.body)) = MD5(TRIM(COALESCE(legacy.texto, legacy.enunciado, ''))) "
        . '  WHERE legacy.prova_id IS NULL AND c.prova_id IS NOT NULL '
        . '  GROUP BY legacy.id '
        . '  HAVING COUNT(DISTINCT c.prova_id) = 1 '
        . ') matched ON matched.id = g.id '
        . 'SET g.prova_id = matched.prova_id '
        . 'WHERE g.prova_id IS NULL'
    );
};
