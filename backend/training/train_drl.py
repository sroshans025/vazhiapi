"""
Training Script — L5 PPO/DQN Strategy Optimizer (Unit IV)
==========================================================
Environment: FinancialWellnessEnv (custom Gymnasium env in drl_optimizer.py)
Dataset: UCI Household Finance (for environment calibration)
Run: python -m training.train_drl

Produces: model_weights/ppo_strategy.zip (Stable-Baselines3 format)
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


def train():
    from stable_baselines3 import PPO
    from stable_baselines3.common.env_util import make_vec_env
    from stable_baselines3.common.callbacks import EvalCallback
    from models.drl_optimizer import build_drl_env

    os.makedirs("model_weights", exist_ok=True)

    # Vectorized environment for parallel rollouts
    env = make_vec_env(build_drl_env, n_envs=4)
    eval_env = make_vec_env(build_drl_env, n_envs=1)

    model = PPO(
        "MlpPolicy",
        env,
        learning_rate=3e-4,
        n_steps=2048,
        batch_size=64,
        n_epochs=10,
        gamma=0.99,
        gae_lambda=0.95,
        clip_range=0.2,
        ent_coef=0.01,
        verbose=1,
    )

    eval_callback = EvalCallback(
        eval_env,
        best_model_save_path="model_weights/",
        log_path="model_weights/",
        eval_freq=5000,
        deterministic=True,
    )

    model.learn(total_timesteps=200_000, callback=eval_callback)
    model.save("model_weights/ppo_strategy")
    print("PPO model saved to model_weights/ppo_strategy.zip")


if __name__ == "__main__":
    train()
