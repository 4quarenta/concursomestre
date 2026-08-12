<?php

declare(strict_types=1);

/**
 * Repõe o catalogo canônico de áreas jurídicas usado na classificação do
 * Planalto. A importação não pode depender de conteúdo pré-existente no banco.
 */
return static function (PDO $db): void {
    $areas = [
        ['constitucional', 'Constitucional', 'Constituicao, direitos fundamentais e organizacao do Estado.', 'Scale', 'text-indigo-600', 10],
        ['penal', 'Penal', 'Crimes, penas e teoria geral aplicada a concursos.', 'Gavel', 'text-rose-600', 20],
        ['administrativo', 'Administrativo', 'Administracao publica, servidores, licitacoes e improbidade.', 'Landmark', 'text-sky-600', 30],
        ['civil', 'Civil', 'Parte geral, obrigacoes, contratos, familia e sucessoes.', 'BookOpen', 'text-emerald-600', 40],
        ['tributario', 'Tributario', 'Sistema tributario, CTN, impostos e processo tributario.', 'Receipt', 'text-amber-600', 50],
        ['processual', 'Processual', 'Processo civil e normas gerais de procedimento.', 'FileText', 'text-violet-600', 60],
        ['processual-penal', 'Processual Penal', 'Inquerito, acao penal, provas, prisao e procedimentos.', 'Shield', 'text-red-600', 70],
        ['legislacao-especial', 'Legislacao Especial', 'Leis especiais recorrentes em editais.', 'Library', 'text-slate-600', 80],
        ['direitos-humanos', 'Direitos Humanos', 'Tratados, garantias fundamentais e sistemas de protecao.', 'HeartHandshake', 'text-pink-600', 90],
        ['trabalho', 'Trabalho', 'Direito material e processual do trabalho.', 'Briefcase', 'text-cyan-600', 100],
        ['ambiental', 'Ambiental', 'Normas ambientais e responsabilidade.', 'Leaf', 'text-green-600', 110],
        ['eleitoral', 'Eleitoral', 'Eleicoes, partidos e justica eleitoral.', 'Vote', 'text-blue-600', 120],
    ];

    $insert = $db->prepare(
        'INSERT IGNORE INTO legal_areas (slug, name, description, icon_name, icon_tone, sort_order) '
        . 'VALUES (:slug, :name, :description, :icon_name, :icon_tone, :sort_order)'
    );

    foreach ($areas as [$slug, $name, $description, $iconName, $iconTone, $sortOrder]) {
        $insert->execute([
            ':slug' => $slug,
            ':name' => $name,
            ':description' => $description,
            ':icon_name' => $iconName,
            ':icon_tone' => $iconTone,
            ':sort_order' => $sortOrder,
        ]);
    }
};
