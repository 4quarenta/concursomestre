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

/** Bounded community reads used by the public law detail aggregate. */
class LegalCommentaryCommunityReadRepository
{
    public function __construct(private PDO $db)
    {
    }

    public function fetchUserComments(
        array $articleIds,
        ?string $viewerUserId = null,
        int $limit = 200
    ): array {
        if (empty($articleIds)) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($articleIds), '?'));
        $stmt = $this->db->prepare(
            "SELECT luc.*,
                    u.plan AS user_plan,
                    u.role AS user_role,
                    u.photo_url AS user_avatar,
                    (SELECT COUNT(*) FROM legal_content_reactions likes_reaction
                     WHERE likes_reaction.target_key = CONCAT('comment:', luc.id)
                       AND likes_reaction.reaction_value = 'like') AS likes,
                    (SELECT COUNT(*) FROM legal_content_reactions dislikes_reaction
                     WHERE dislikes_reaction.target_key = CONCAT('comment:', luc.id)
                       AND dislikes_reaction.reaction_value = 'dislike') AS dislikes,
                    viewer.reaction_value AS user_reaction,
                    viewer_report.id AS viewer_report_id
             FROM legal_user_comments luc
             LEFT JOIN users u ON u.id = luc.user_id
             LEFT JOIN legal_content_reactions viewer
                    ON viewer.target_key = CONCAT('comment:', luc.id)
                   AND viewer.user_id = ?
             LEFT JOIN legal_comment_reports viewer_report
                    ON viewer_report.comment_id = luc.id
                   AND viewer_report.user_id = ?
             WHERE luc.law_article_id IN ($placeholders)
               AND luc.status != 'deleted'
               AND (luc.moderation_status = 'approved'
                    OR (luc.moderation_status = 'pending' AND luc.user_id = ?))
             ORDER BY luc.created_at DESC, luc.id DESC
             LIMIT " . (max(1, min(500, $limit)) + 1)
        );
        $viewerId = $viewerUserId ?? '';
        $stmt->execute(array_merge([$viewerId, $viewerId], $articleIds, [$viewerId]));

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
