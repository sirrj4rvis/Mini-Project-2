import pandas as pd
import os

print("Amazon Data:")
df_amz = pd.read_csv(r"C:\Users\DELL\.cache\kagglehub\datasets\muqaddasejaz\amazon-products-dataset\versions\1\products.csv")
print(df_amz.columns)
print(df_amz.head(1))

print("\nFlipkart Data:")
fp_dir = r"C:\Users\DELL\.cache\kagglehub\datasets\shrikrishnaparab\flipkart-products-dataset\versions\2\flipkart data"
files = os.listdir(fp_dir)
print("Files:", files)
if files:
    for f in files:
        if f.endswith('.csv'):
            print(f"Reading {f}")
            df_fk = pd.read_csv(os.path.join(fp_dir, f))
            print(df_fk.columns)
            print(df_fk.head(1))
            break
