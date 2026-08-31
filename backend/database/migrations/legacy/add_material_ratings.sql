-- Add material_ratings table
CREATE TABLE IF NOT EXISTS material_ratings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    material_id INT NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_material (user_id, material_id),
    KEY idx_user_id (user_id),
    KEY idx_material_id (material_id)
);
